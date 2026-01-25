import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Linking,
  Platform,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  Modal,
  FlatList,
  InteractionManager,
} from 'react-native';
import MapView, { Polygon, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Card, Divider } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeIonicons } from '../components/SafeIcons';
import DatabaseManager from '../data/database';
import collectivesParser from '../data/collectives';
import normalizeProperties from '../utils/normalizeProperties';
import { collectFitCoordinates } from '../utils/mapUtils';
import { AffectataireSummary, MandataireInfo, ParcelInfo } from '../ui/organisms/ParcelDetailComponents';
import MapControls from '../ui/molecules/MapControls';

// Use useWindowDimensions for better responsiveness
const { width: screenWidth } = Dimensions.get('window');

const mapProvider = Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined;

// Simple error boundary
class ParcelDetailErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: any) { return { error }; }
  componentDidCatch(error: any, info: any) {
    console.error('ParcelDetailScreen render error', error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1, padding: 16, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontWeight: '700', marginBottom: 8, color: '#A02020' }}>Erreur d'affichage de la parcelle</Text>
          <Text style={{ textAlign: 'center', fontSize: 12, color: '#555' }}>Un problème est survenu lors du rendu des détails de la parcelle. Consultez le log pour plus d'infos.</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

// Sanitize coords
function sanitizeCoords(raw: any): { latitude: number; longitude: number }[] {
  if (!Array.isArray(raw)) return [];
  return raw.reduce((out: { latitude: number; longitude: number }[], c: any) => {
    if (Array.isArray(c) && c.length >= 2) {
      const lon = Number(c[0]);
      const lat = Number(c[1]);
      if (isFinite(lat) && isFinite(lon)) out.push({ latitude: lat, longitude: lon });
    }
    return out;
  }, [] as { latitude: number; longitude: number }[]);
}

// Decimate coords
function decimateCoords(coords: { latitude: number; longitude: number }[], maxPoints = 800) {
  if (!Array.isArray(coords)) return [] as { latitude: number; longitude: number }[];
  if (coords.length <= maxPoints) return coords;
  const step = Math.ceil(coords.length / maxPoints);
  const reduced: { latitude: number; longitude: number }[] = [];
  for (let i = 0; i < coords.length; i += step) reduced.push(coords[i]);
  if (reduced.length > 2) {
    const first = reduced[0];
    const last = reduced[reduced.length - 1];
    if (first.latitude !== last.latitude || first.longitude !== last.longitude) {
      reduced.push({ ...first });
    }
  }
  return reduced;
}

function safeParseJSON<T = any>(raw: any): T | null {
  if (!raw || typeof raw !== 'string') return raw || null;
  try { return JSON.parse(raw); } catch (e) { console.warn('safeParseJSON failed'); return null; }
}

const ParcelDetailScreen = ({ route, navigation, dbReady: parentDbReady }: any) => {
  const params = route?.params || {};
  const { parcel, geometry, properties } = params;
  const MAX_DIST_METERS = 2000; // 2 km (reduced from 5 km)

  const quickExtractProperties = (s: string) => {
    try {
      if (!s || typeof s !== 'string') return {};
      const out: any = {};
      const tryKeys = ['Date_naiss', 'Date_nais', 'Date_nai', 'Date_naissance', 'Date_de_naissance', 'DateNaissance', 'Date_naiss1', 'Date_naiss_1'];
      for (const k of tryKeys) {
        const re = new RegExp(`\"${k}\"\\s*:\\s*\\\"([^\\\"]+)\\\"`, 'i');
        const m = s.match(re);
        if (m && m[1]) { out[k] = m[1].trim(); break; }
      }
      const reNum = /\"(?:Num_piece|Numero_piece|Num_piec|Num_piece_001|Num_piece_1)\"\s*:\s*\"([^\"]+)\"/i;
      const mn = s.match(reNum); if (mn && mn[1]) out.Num_piece = mn[1].trim();
      const reTel = /\"(?:Telephone|Telephone_001|Telephon2)\"\s*:\s*\"([^\"]+)\"/i;
      const mt = s.match(reTel); if (mt && mt[1]) out.Telephone = mt[1].trim();
      return out;
    } catch (e) { return {}; }
  };

  const [propsObj, setPropsObj] = useState<any>(() => {
    // Prefer explicit `properties` param when provided (neighbor navigation passes parsed properties)
    if (properties && typeof properties === 'object') return properties;
    if (properties && typeof properties === 'string') {
      return { ...(parcel || {}), ...quickExtractProperties(properties) };
    }
    if (parcel) return parcel;
    return {};
  });

  useEffect(() => {
    let cancelled = false;
    if (properties && typeof properties === 'string') {
      InteractionManager.runAfterInteractions(() => {
        if (cancelled) return;
        const parsed = safeParseJSON(properties);
        setPropsObj(parsed || parcel || {});
      });
    } else if (properties && typeof properties === 'object') {
      setPropsObj(properties);
    } else if (parcel && Object.keys(propsObj).length === 0) {
      setPropsObj(parcel);
    }
    return () => { cancelled = true; };
  }, [properties, parcel, propsObj]);

  const [normalizedProps, setNormalizedProps] = useState<any>(null);
  const [affectatairesMerged, setAffectatairesMerged] = useState<any>(null);
  const [dbReady, setDbReady] = useState<boolean>(!!parentDbReady);
  const [dbError, setDbError] = useState<string | null>(null);

  const mapRef = useRef<any>(null);
  const scrollRef = useRef<any>(null);

  const [mainParcelRings, setMainParcelRings] = useState<any[]>([]);
  const [mapReady, setMapReady] = useState<boolean>(false);
  const [showMap, setShowMap] = useState<boolean>(true);
  const [showNeighbors, setShowNeighbors] = useState<boolean>(false);
  const [showAffectatairesModal, setShowAffectatairesModal] = useState<boolean>(false);
  const [affectatairesExpanded, setAffectatairesExpanded] = useState<boolean>(false);
  const [neighborParcels, setNeighborParcels] = useState<any[]>([]);
  const [loadingNeighbors, setLoadingNeighbors] = useState<boolean>(false);
  const [spatialDbBroken, setSpatialDbBroken] = useState<boolean>(false);
  const centroidRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const attemptedDbGeometryRef = useRef<boolean>(false);

  useEffect(() => {
    if (typeof parentDbReady === 'boolean') {
      setDbReady(!!parentDbReady);
      setDbError(null);
      return;
    }

    const checkDb = async () => {
      InteractionManager.runAfterInteractions(async () => {
        try {
          let ready = false;
          const stats: any = await DatabaseManager.getStats?.();
          ready = !!(stats && typeof stats.totalParcels === 'number');
          if (!ready) {
            const r: any = DatabaseManager.db?.getFirstSync?.('SELECT COUNT(*) as count FROM parcels');
            ready = !!(r && (r.count as any) && typeof r.count === 'number');
          }
          setDbReady(ready);
          setDbError(null);
        } catch (err) {
          setDbReady(false);
          setDbError(String(err || 'Database check failed'));
        }
      });
    };
    checkDb();
  }, [parentDbReady]);

  useEffect(() => {
    if (typeof parentDbReady === 'boolean' && parentDbReady !== dbReady) {
      setDbReady(!!parentDbReady);
    }
  }, [parentDbReady]);

  useEffect(() => {
    if (__DEV__) {
      console.log('ParcelDetail TRACE', {
        parcelNum: parcel?.num_parcel || parcel?.id || null,
        dbReady,
        propsKeys: propsObj ? Object.keys(propsObj).length : 0,
        hasGeometry: !!geometry,
        normalizedPresent: !!normalizedProps,
        affectatairesMergedPresent: !!affectatairesMerged,
        neighborCount: neighborParcels.length,
      });
    }
  }, [parcel, dbReady, propsObj, geometry, normalizedProps, affectatairesMerged, neighborParcels]);

  useEffect(() => {
    let cancelled = false;
    if (propsObj && Object.keys(propsObj).length > 0) {
      InteractionManager.runAfterInteractions(() => {
        if (cancelled) return;
        const normalized = normalizeProperties(propsObj);
        if (normalized) {
          setNormalizedProps(normalized);
          if (__DEV__) {
            console.log('ParcelDetail: normalizedProps summary', { mandataire: normalized.mandataire || null, affectatairesCount: normalized.affectatairesCount || 0 });
          }
        }
      });
    }
    return () => { cancelled = true; };
  }, [propsObj]);

  const loadCollectivesFallback = useCallback(async () => {
    if (!(propsObj && Object.keys(propsObj).length > 0)) return;
    await new Promise((resolve) => InteractionManager.runAfterInteractions(() => resolve(null)));
    const parcelKey = String(propsObj?.Num_parcel || propsObj?.Numparcel || propsObj?.num_parcel || parcel?.num_parcel || '').trim();
    if (!parcelKey) return;
    if (affectatairesMerged && affectatairesMerged.Prenom) return;
    try {
      // Use synchronous require to avoid async chunking which can produce undefined dependency paths in Metro
      let PRE: any = null;
      try {
        const mod = require('../../prebuilt/collectives_index.json');
        PRE = mod && (mod.default || mod);
        if (PRE) {
          // Debug: confirm the prebuilt collectives JSON is bundled and accessible
          // This helps diagnose Hermes "Requiring unknown module" issues.
          try { console.debug && console.debug('ParcelDetail: collectives_index.json loaded (fallback)', Object.keys(PRE).length); } catch (e) {}
        }
      } catch (e) {
        PRE = null;
      }
      if (PRE && PRE[parcelKey]) {
        setAffectatairesMerged(PRE[parcelKey]);
        if (__DEV__) console.debug('ParcelDetail: found prebuilt collectives entry', { parcelKey });
      }
    } catch (e) {
      console.warn('Failed to load collectives_index.json:', e);
    }
  }, [propsObj, parcel, affectatairesMerged]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Prefer synchronous require for the small prebuilt JSON to avoid async chunking
        let PRE: any = null;
        try {
          const mod = require('../../prebuilt/collectives_index.json');
          PRE = (mod && (mod.default || mod)) || null;
          if (PRE) {
            try { console.debug && console.debug('ParcelDetail: collectives_index.json loaded (mount)', Object.keys(PRE).length); } catch (e) {}
          }
        } catch (e) {
          PRE = null;
        }
        if (!PRE) return;
        const parcelKey = String((params?.parcel && (params.parcel.num_parcel || params.parcel.id)) || (params?.properties && (params.properties.Num_parcel || params.properties.num_parcel || params.properties.Num_parcel_2)) || '').trim();
        if (mounted && parcelKey && PRE[parcelKey]) {
          setAffectatairesMerged(PRE[parcelKey]);
        }
      } catch (e) {
        console.warn('Failed to load collectives_index.json in mount effect:', e);
      }
    })();
    return () => { mounted = false; };
  }, [params]);

  const insets = useSafeAreaInsets();

  const getProperty = useCallback((key: string) => {
    const v = propsObj?.[key];
    if (v === undefined || v === null || v === '') return 'Non disponible';
    return String(v);
  }, [propsObj]);

  const displayValue = useCallback((v: any, fallback = 'Non disponible') => {
    if (v === undefined || v === null) return fallback;
    const s = String(v).trim();
    if (!s || s === '-' || s.toLowerCase() === 'null') return fallback;
    return s;
  }, []);

  const getBestValue = useCallback((candidates: any[], fallback: any = '') => {
    if (!Array.isArray(candidates)) return fallback;
    for (const c of candidates) {
      if (c === undefined || c === null) continue;
      const s = String(c).trim();
      if (s && s !== '-' && s.toLowerCase() !== 'null') return s;
    }
    return fallback;
  }, []);

  const parseToDate = useCallback((input: any): Date | null => {
    if (!input && input !== 0) return null;
    if (input instanceof Date) return isNaN(input.getTime()) ? null : input;
    let s = String(input).trim();
    if (!s) return null;

    if (/^\d+$/.test(s)) {
      const n = parseInt(s, 10);
      if (n > 1e12) return new Date(n);
      if (n > 1e9) return new Date(n * 1000);
    }

    const dm = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (dm) {
      const day = parseInt(dm[1], 10);
      const month = parseInt(dm[2], 10) - 1;
      let year = parseInt(dm[3], 10);
      if (year < 100) year += 1900;
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) {
        const y = d.getFullYear();
        const now = new Date().getFullYear();
        if (y >= 1900 && y <= now) return d;
      }
    }

    const iso = new Date(s);
    if (!isNaN(iso.getTime())) {
      const y = iso.getFullYear();
      const now = new Date().getFullYear();
      if (y >= 1900 && y <= now) return iso;
    }
    return null;
  }, []);

  const calculateAge = useCallback((dateInput: string | Date) => {
    const d = parseToDate(dateInput);
    if (!d) return null;
    const today = new Date();
    let age = today.getFullYear() - d.getFullYear();
    const m = today.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age -= 1;
    return age >= 0 ? age : null;
  }, [parseToDate]);

  const formatDateWithAge = useCallback((dateStr: string) => {
    if (!dateStr) return 'Non spécifiée';
    const d = parseToDate(dateStr);
    if (!d) return 'Non spécifiée';
    const age = calculateAge(dateStr);
    return `${d.toLocaleDateString()}${age !== null ? ` (${age} ans)` : ''}`;
  }, [calculateAge, parseToDate]);

  const getValueOrFallback = useCallback((obj: any, key: string, fallback: any = 'Non disponible') => {
    if (!obj) return fallback;
    const variants = [key, key.toLowerCase(), key.toUpperCase(), key.replace(/_/g, ''), key.charAt(0).toLowerCase() + key.slice(1)];
    for (const k of variants) {
      if (obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== '') return String(obj[k]);
      if (obj.properties && obj.properties[k] !== undefined && obj.properties[k] !== null && String(obj.properties[k]).trim() !== '') return String(obj.properties[k]);
    }
    return fallback;
  }, []);

  // Try many variants and fallbacks for a given logical field name
  const getCanonicalValue = useCallback((obj: any, normalizedObj: any, logicalKey: 'Vocation' | 'type_usag') => {
    const variantsMap: Record<string, string[]> = {
      Vocation: ['Vocation', 'Vocation_1', 'vocation', 'vocation_1', 'Vocation1', 'vocation1', 'vocation_1_col', 'Vocation_col'],
      type_usag: ['type_usag', 'type_usa', 'typeusage', 'type_usage', 'Type_usage', 'type_usa_1', 'type_usa_col', 'type_usag_col'],
    };
    const variants = variantsMap[logicalKey] || [logicalKey];
    // check normalizedProps/normalizedObj first
    if (normalizedObj && typeof normalizedObj === 'object') {
      for (const k of variants) {
        if (normalizedObj[k] !== undefined && normalizedObj[k] !== null && String(normalizedObj[k]).trim() !== '') return String(normalizedObj[k]);
        const kl = k.toLowerCase();
        if (normalizedObj[kl] !== undefined && normalizedObj[kl] !== null && String(normalizedObj[kl]).trim() !== '') return String(normalizedObj[kl]);
      }
    }
    // check top-level props
    if (obj && typeof obj === 'object') {
      for (const k of variants) {
        if (obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== '') return String(obj[k]);
        const kl = k.toLowerCase();
        if (obj[kl] !== undefined && obj[kl] !== null && String(obj[kl]).trim() !== '') return String(obj[kl]);
      }
      // nested properties
      if (obj.properties && typeof obj.properties === 'object') {
        for (const k of variants) {
          if (obj.properties[k] !== undefined && obj.properties[k] !== null && String(obj.properties[k]).trim() !== '') return String(obj.properties[k]);
          const kl = k.toLowerCase();
          if (obj.properties[kl] !== undefined && obj.properties[kl] !== null && String(obj.properties[kl]).trim() !== '') return String(obj.properties[kl]);
        }
      }
    }
    return 'Non disponible';
  }, []);

  const pickMandField = useCallback((keys: string[], normalizedKey?: string, localProps?: any) => {
    if (normalizedKey && normalizedProps?.mandataire) {
      const nv = normalizedProps.mandataire[normalizedKey];
      if (nv && String(nv).trim() !== '-' ) return String(nv).trim();
    }
    if (affectatairesMerged) {
      for (const k of keys) {
        const v = affectatairesMerged[k];
        if (v !== undefined && v !== null) {
          const s = String(v).split('\n')[0].trim();
          if (s && s !== '-') return s;
        }
        const kl = k.toLowerCase();
        if (affectatairesMerged[kl] !== undefined && affectatairesMerged[kl] !== null) {
          const s2 = String(affectatairesMerged[kl]).split('\n')[0].trim();
          if (s2 && s2 !== '-') return s2;
        }
      }
    }
    const p = localProps || {};
    for (const k of keys) {
      if (p[k] && String(p[k]).trim() !== '-') return String(p[k]).trim();
      if (propsObj[k] && String(propsObj[k]).trim() !== '-') return String(propsObj[k]).trim();
      if (p.properties?.[k] && String(p.properties[k]).trim() !== '-') return String(p.properties[k]).trim();
      if (propsObj.properties?.[k] && String(propsObj.properties[k]).trim() !== '-') return String(propsObj.properties[k]).trim();
      const kl = k.toLowerCase();
      if (p[kl] && String(p[kl]).trim() !== '-') return String(p[kl]).trim();
      if (propsObj[kl] && String(propsObj[kl]).trim() !== '-') return String(propsObj[kl]).trim();
      if (p.properties?.[kl] && String(p.properties[kl]).trim() !== '-') return String(p.properties[kl]).trim();
      if (propsObj.properties?.[kl] && String(propsObj.properties[kl]).trim() !== '-') return String(propsObj.properties[kl]).trim();
    }
    return null;
  }, [normalizedProps, propsObj, affectatairesMerged]);

  const findDateInProps = useCallback((localProps?: any, sourceProps?: any) => {
    const keys = ['Date_naiss', 'Date_nais', 'Date_nai', 'Date_naissance', 'Date_de_naissance', 'DateNaissance', 'datenaissance', 'date_naissance', 'dob', 'birth_date', 'Date_naiss1', 'Date_naiss_1'];
    const p = localProps || {};
    for (const k of keys) {
      const variants = [k, k.toLowerCase(), k.toUpperCase(), k.replace(/_/g, ''), k.charAt(0).toLowerCase() + k.slice(1)];
      for (const kk of variants) {
        if (p[kk] && String(p[kk]).trim() !== '') return String(p[kk]).trim();
        if (p.properties?.[kk] && String(p.properties[kk]).trim() !== '') return String(p.properties[kk]).trim();
        if (sourceProps?.[kk] && String(sourceProps[kk]).trim() !== '') return String(sourceProps[kk]).trim();
        if (sourceProps?.properties?.[kk] && String(sourceProps.properties[kk]).trim() !== '') return String(sourceProps.properties[kk]).trim();
      }
    }
    const scan = (obj: any) => {
      if (!obj || typeof obj !== 'object') return null;
      for (const k of Object.keys(obj)) {
        if (/date.*(naiss|naissance)|datenaiss|dob|birth/i.test(k)) {
          const v = obj[k];
          if (v) {
            const s = String(v).trim();
            if (parseToDate(s)) return s;
          }
        }
      }
      return null;
    };
    return scan(p) || scan(sourceProps) || null;
  }, [parseToDate]);

  useEffect(() => {
    if (affectatairesMerged) return;
    const mand = normalizedProps?.mandataire;
    const needsMore = mand && (!mand.numero && !mand.numero_piece && !mand.Numero && !mand.sexe && !mand.age && !mand.Date_naissance && !mand.Date_naiss);
    if (needsMore && propsObj && Object.keys(propsObj).length > 0) {
      loadCollectivesFallback().catch(() => {});
    }
  }, [normalizedProps, propsObj, affectatairesMerged, loadCollectivesFallback]);

  const loadNeighborParcels = useCallback(async () => {
    if (!parcel || spatialDbBroken) return;
    const parcelNum = parcel?.num_parcel || propsObj?.Num_parcel || propsObj?.num_parcel || parcel?.id;
    if (!parcelNum) return;
    setLoadingNeighbors(true);
    try {
      let list = await DatabaseManager.getNeighborParcels?.(String(parcelNum)) || [];
      if ((!Array.isArray(list) || list.length === 0) && !spatialDbBroken && propsObj) {
        const village = String(propsObj?.Village || propsObj?.village || '');
        if (village) {
          const byVillage = await DatabaseManager.getParcelsByVillage?.(village) || [];
          // remove self
          let candidates = byVillage.filter((p: any) => String(p?.num_parcel || p?.Num_parcel || p?.id) !== String(parcelNum));

          // If we have geometry for the current parcel, compute centroid and filter candidates by distance
          try {
            const rawGeom = geometry || (parcel && parcel.geometry) || propsObj?.geometry || propsObj || null;
            const parseGeom = (g: any) => {
              try {
                return typeof g === 'string' ? safeParseJSON(g) || null : g || null;
              } catch (e) { return null; }
            };
            const baseGeom = parseGeom(rawGeom);
            let baseCentroid: { latitude: number; longitude: number } | null = null;
            if (baseGeom && baseGeom.type && baseGeom.coordinates) {
              let coords0: any = null;
              if (baseGeom.type === 'Polygon' && Array.isArray(baseGeom.coordinates[0])) coords0 = baseGeom.coordinates[0];
              else if (baseGeom.type === 'MultiPolygon' && Array.isArray(baseGeom.coordinates) && Array.isArray(baseGeom.coordinates[0]) && Array.isArray(baseGeom.coordinates[0][0])) coords0 = baseGeom.coordinates[0][0];
              if (coords0) {
                const sc = sanitizeCoords(coords0);
                if (sc.length > 0) {
                  let latSum = 0, lonSum = 0;
                  sc.forEach((pt: { latitude: number; longitude: number }) => { latSum += pt.latitude; lonSum += pt.longitude; });
                  baseCentroid = { latitude: latSum / sc.length, longitude: lonSum / sc.length };
                }
              }
            }

            // distance helper meters
            const haversine = (a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) => {
              const toRad = (n: number) => n * Math.PI / 180;
              const R = 6371000;
              const dLat = toRad(b.latitude - a.latitude);
              const dLon = toRad(b.longitude - a.longitude);
              const lat1 = toRad(a.latitude);
              const lat2 = toRad(b.latitude);
              const h = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon/2) * Math.sin(dLon/2);
              return 2 * R * Math.asin(Math.sqrt(h));
            };

            if (baseCentroid && candidates.length > 0) {
              const filtered: any[] = [];
              for (const c of candidates) {
                try {
                  const cgRaw = c.geometry || c.geometry_string || c.geom || null;
                  const cg = typeof cgRaw === 'string' ? safeParseJSON(cgRaw) || null : cgRaw || null;
                  let coordsC: any = null;
                  if (cg && cg.type === 'Polygon' && Array.isArray(cg.coordinates) && Array.isArray(cg.coordinates[0])) coordsC = cg.coordinates[0];
                  else if (cg && cg.type === 'MultiPolygon' && Array.isArray(cg.coordinates) && Array.isArray(cg.coordinates[0]) && Array.isArray(cg.coordinates[0][0])) coordsC = cg.coordinates[0][0];
                  if (!coordsC) continue;
                  const sc2 = sanitizeCoords(coordsC);
                  if (!sc2 || sc2.length === 0) continue;
                  let latSum2 = 0, lonSum2 = 0;
                  sc2.forEach((pt: { latitude: number; longitude: number }) => { latSum2 += pt.latitude; lonSum2 += pt.longitude; });
                  const centroidC = { latitude: latSum2 / sc2.length, longitude: lonSum2 / sc2.length };
                  const d = haversine(baseCentroid, centroidC);
                  if (d <= MAX_DIST_METERS) filtered.push(c);
                } catch (e) {
                  // ignore candidate if parsing fails
                }
              }
              if (filtered.length > 0) candidates = filtered;
            }
          } catch (e) {
            // if anything went wrong, keep the original candidates
          }

          list = candidates;
          if (list.length > 10) list = list.slice(0, 10);
        }
      }
      if (Array.isArray(list) && list.length > 0) {
        // normalize neighbor geometry and properties for consistent UI behavior
        const parsedList = list.map((n: any) => {
          const rawGeom = n.geometry || n.geometry_string || n.geom || n;
          try {
            const { normalizeGeometry } = require('../utils/geometryUtils');
            n.__parsedGeometry = normalizeGeometry(rawGeom) || safeParseJSON(rawGeom) || rawGeom || null;
          } catch (e) {
            n.__parsedGeometry = safeParseJSON(rawGeom) || rawGeom || null;
          }

          const rawProps = n.properties || n.properties_string || n.props || n;
          try {
            const normalizeProperties = require('../utils/normalizeProperties').default;
            const parsedProps = safeParseJSON(rawProps) || rawProps || {};
            const structured = normalizeProperties(parsedProps);
            n.__parsedProps = structured;
            // Build a flattened / canonical props object to ensure common keys exist for UI
            const flat: any = (typeof parsedProps === 'object' && parsedProps) ? { ...parsedProps } : {};
            // helper to pick variant keys
            const pickVariant = (obj: any, variants: string[]) => {
              for (const v of variants) {
                if (obj[v] !== undefined && obj[v] !== null && String(obj[v]).trim() !== '') return obj[v];
              }
              return undefined;
            };
            const vocationVal = pickVariant(parsedProps, ['Vocation', 'Vocation_1', 'vocation', 'vocation_1', 'Vocation1', 'vocation1']);
            if (vocationVal !== undefined) flat.Vocation = vocationVal;
            const typeVal = pickVariant(parsedProps, ['type_usag', 'type_usa', 'typeusage', 'type_usage', 'Type_usage', 'type_usa_1']);
            if (typeVal !== undefined) flat.type_usag = typeVal;
            // ensure Num_parcel variants
            const numVal = pickVariant(parsedProps, ['Num_parcel', 'num_parcel', 'Numparcel', 'numparcel', 'num_parc']);
            if (numVal !== undefined) flat.Num_parcel = numVal;
            n.__parsedPropsFlat = flat;
          } catch (e) {
            const parsed = safeParseJSON(rawProps) || rawProps || {};
            n.__parsedProps = parsed;
            n.__parsedPropsFlat = (typeof parsed === 'object' && parsed) ? { ...parsed } : parsed;
          }
          return n;
        });
        setNeighborParcels(parsedList);
        // ensure map updates to show neighbors immediately
        try { console.debug && console.debug('loadNeighborParcels parsed neighbors count', parsedList.length); } catch (e) {}
        try {
          // log a compact summary of canonical keys for debugging
          const summary = parsedList.map((n: any) => ({ id: n?.num_parcel || n?.id || null, Vocation: (n.__parsedPropsFlat||n.__parsedProps||n.properties||{}).Vocation, type_usag: (n.__parsedPropsFlat||n.__parsedProps||n.properties||{}).type_usag }));
          console.debug && console.debug('loadNeighborParcels neighbor summary', summary.slice(0, 20));
        } catch (e) {}
        setTimeout(() => {
          try { fitMapToParcel(); } catch (e) { console.warn('fitMapToParcel after neighbors failed', e); }
        }, 120);
      } else {
        setNeighborParcels([]);
      }
    } catch (e) {
      console.warn('loadNeighborParcels error', e);
      setSpatialDbBroken(true);
    } finally {
      setLoadingNeighbors(false);
    }
  }, [parcel, propsObj, spatialDbBroken]);

  const navigateToNeighbor = useCallback((neighbor: any) => {
    try {
      const rawGeom = neighbor?.__parsedGeometry ?? neighbor?.geometry ?? neighbor?.geometry_string ?? neighbor?.geom;
      const parsedGeom = typeof rawGeom === 'string' ? safeParseJSON(rawGeom) || null : rawGeom || null;
      const parsedProps = neighbor.__parsedPropsFlat || neighbor.__parsedProps || neighbor.properties || neighbor;
      try { console.debug && console.debug('navigateToNeighbor using parsedProps keys', Object.keys(parsedProps || {}).slice(0,40)); } catch (e) {}
      try { console.debug && console.debug('navigateToNeighbor parsedProps keys', Object.keys(parsedProps || {}).slice(0,30), 'parcelId', neighbor?.num_parcel || neighbor?.id); } catch (e) {}
      // Merge parsed flat props and parsed geometry into the neighbor parcel object so the detail screen has canonical props and geometry immediately
      const mergedParcel: any = { ...(neighbor || {}), ...(parsedProps || {}) };
      if (parsedGeom && parsedGeom.type && parsedGeom.coordinates) mergedParcel.geometry = parsedGeom;
      else if (neighbor && (neighbor.geometry || neighbor.geometry_string || neighbor.geom)) mergedParcel.geometry = neighbor.geometry || neighbor.geometry_string || neighbor.geom;
      // Try to produce a normalized parsed geometry object to attach as __parsedGeometry so downstream code can use it deterministically
      try {
        const { normalizeGeometry } = require('../utils/geometryUtils');
        const norm = normalizeGeometry(mergedParcel.geometry || mergedParcel.__parsedGeometry || null) || null;
        if (norm) {
          mergedParcel.__parsedGeometry = norm;
          // also set geometry to a JSON string for DB-style consumers if needed
          try { mergedParcel.geometry = typeof norm === 'object' ? JSON.stringify(norm) : mergedParcel.geometry; } catch (e) {}
        }
      } catch (e) {
        // ignore - normalization optional
      }
      const params: any = { parcel: mergedParcel, properties: parsedProps, __directNavigate: true };
      if (parsedGeom && parsedGeom.type && parsedGeom.coordinates) params.geometry = parsedGeom;
      navigation.push('ParcelDetail', params);
    } catch (e) {
      try { navigation.push('ParcelDetail', { parcel: neighbor }); } catch (_e) { /* ignore */ }
    }
  }, [navigation]);

  // If the route params indicate we were navigated to directly with parsed props,
  // ensure we adopt those props immediately to avoid any intermediate 'Non disponible' UI.
  useEffect(() => {
    try {
      const incoming = route?.params || {};
      if (incoming.__directNavigate) {
        const p = incoming.properties || incoming.props || incoming.parcel || {};
        if (p && typeof p === 'object') {
          setPropsObj(p);
          try {
            const normalized = normalizeProperties(p);
            if (normalized) setNormalizedProps(normalized);
          } catch (e) {}
        }
        // If geometry was provided in params, parse and set mainParcelRings + centroid immediately
        try {
          const geom = incoming.geometry || incoming.parcel?.geometry || null;
          if (geom && geom.type && geom.coordinates) {
            const parseAndSet = (g: any) => {
              const rings: any[] = [];
              if (g.type === 'Polygon' && Array.isArray(g.coordinates[0])) {
                let coords = sanitizeCoords(g.coordinates[0]);
                if (coords.length > 1800) coords = decimateCoords(coords);
                rings.push(coords);
              } else if (g.type === 'MultiPolygon' && Array.isArray(g.coordinates)) {
                g.coordinates.forEach((poly: any) => {
                  if (Array.isArray(poly) && Array.isArray(poly[0])) {
                    let coords = sanitizeCoords(poly[0]);
                    if (coords.length > 1800) coords = decimateCoords(coords);
                    rings.push(coords);
                  }
                });
              }
              if (rings.length > 0 && rings[0].length > 0) {
                const firstRing = rings[0] as { latitude: number; longitude: number }[];
                let latSum = 0, lonSum = 0;
                for (const p0 of firstRing) { const lat = Number(p0.latitude); const lon = Number(p0.longitude); if (isFinite(lat) && isFinite(lon)) { latSum += lat; lonSum += lon; } }
                centroidRef.current = { latitude: latSum / firstRing.length, longitude: lonSum / firstRing.length };
              }
              setMainParcelRings(rings);
            };
            parseAndSet(geom);
            setTimeout(() => { try { fitMapToParcel(); } catch (e) {} }, 160);
          }
        } catch (e) {}
      }
    } catch (e) {}
  }, [route?.params]);

  const handleNeighborPress = useCallback((neighbor: any) => {
    try {
      const geom = neighbor?.__parsedGeometry || neighbor?.geometry || neighbor?.geometry_string || neighbor?.geom || null;
      const propsFlat = neighbor?.__parsedPropsFlat || neighbor?.__parsedProps || neighbor?.properties || neighbor || {};
      console.debug && console.debug('handleNeighborPress neighbor id', neighbor?.num_parcel || neighbor?.id || null, 'geomType', geom?.type || null, 'centroid?', centroidRef.current || null);
      try { console.debug && console.debug('handleNeighborPress propsFlat sample keys', Object.keys(propsFlat || {}).slice(0,40)); } catch (e) {}
      try { console.debug && console.debug('handleNeighborPress geom preview', (geom && geom.coordinates) ? (Array.isArray(geom.coordinates) ? geom.coordinates[0] : geom.coordinates) : null); } catch (e) {}
    } catch (e) {}
    navigateToNeighbor(neighbor);
  }, [navigateToNeighbor]);

  useEffect(() => {
    if (showNeighbors && neighborParcels.length === 0 && !loadingNeighbors) {
      loadNeighborParcels();
    }
  }, [showNeighbors, neighborParcels.length, loadNeighborParcels, loadingNeighbors]);

  useEffect(() => {
    let cancelled = false;
    let raw = geometry || (parcel && parcel.geometry) || null;
    if (!raw && parcel?.num_parcel && !attemptedDbGeometryRef.current) {
      attemptedDbGeometryRef.current = true;
      InteractionManager.runAfterInteractions(async () => {
        try {
          const parsed = await DatabaseManager.getParcelGeometry?.(parcel.num_parcel);
          if (parsed && !cancelled) {
            navigation.setParams({ geometry: parsed });
            raw = parsed;
          } else {
            const rec = await DatabaseManager.getParcelByNum?.(parcel.num_parcel);
            if (rec && (rec as any).geometry && !cancelled) {
              const parsed2 = safeParseJSON((rec as any).geometry) || (rec as any).geometry;
              navigation.setParams({ geometry: parsed2 });
              raw = parsed2;
            }
          }
          if (raw && !cancelled) parseAndSet(raw);
        } catch (e) {
          console.warn('DB geometry fetch failed', e);
          if (!cancelled) setMainParcelRings([]);
        }
      });
    }
    const parseAndSet = (geom: any) => {
      if (!geom || !geom.type || !geom.coordinates) { setMainParcelRings([]); return; }
      const rings: any[] = [];
      if (geom.type === 'Polygon' && Array.isArray(geom.coordinates[0])) {
        let coords = sanitizeCoords(geom.coordinates[0]);
        if (coords.length > 1800) coords = decimateCoords(coords);
        rings.push(coords);
      } else if (geom.type === 'MultiPolygon' && Array.isArray(geom.coordinates)) {
        geom.coordinates.forEach((poly: any) => {
          if (Array.isArray(poly) && Array.isArray(poly[0])) {
            let coords = sanitizeCoords(poly[0]);
            if (coords.length > 1800) coords = decimateCoords(coords);
            rings.push(coords);
          }
        });
      }
      if (rings.length > 0 && rings[0].length > 0) {
        const firstRing = rings[0] as { latitude: number; longitude: number }[];
        let latSum = 0, lonSum = 0;
        firstRing.forEach((p: { latitude: number; longitude: number }) => { const lat = Number(p.latitude); const lon = Number(p.longitude); if (isFinite(lat) && isFinite(lon)) { latSum += lat; lonSum += lon; } });
        centroidRef.current = { latitude: latSum / firstRing.length, longitude: lonSum / firstRing.length };
      }
      setMainParcelRings(rings);
    };
    if (typeof raw === 'string') {
      InteractionManager.runAfterInteractions(() => {
        if (cancelled) return;
        const geom = safeParseJSON(raw);
        if (!geom) { setMainParcelRings([]); return; }
        parseAndSet(geom);
      });
    } else if (raw) {
      parseAndSet(raw);
    } else {
      setMainParcelRings([]);
    }
    return () => { cancelled = true; };
  }, [geometry, parcel, navigation]);

  const dialNumber = useCallback(async (phone?: string) => {
    if (!phone) return;
    const normalized = String(phone).replace(/[^0-9+]/g, '');
    if (!normalized) return;
    const telUrl = `tel:${normalized}`;
    try {
      if (await Linking.canOpenURL(telUrl)) {
        await Linking.openURL(telUrl);
      } else {
        Alert.alert('Erreur', "Impossible d'ouvrir l'application téléphone.");
      }
    } catch (e) {
      Alert.alert('Erreur', "Impossible de lancer l'appel.");
    }
  }, []);

  const mapRegion = useMemo(() => {
    const centroid = centroidRef.current;
    if (!centroid) return { latitude: 14.7167, longitude: -17.4677, latitudeDelta: 0.1, longitudeDelta: 0.1 };
    return {
      latitude: centroid.latitude,
      longitude: centroid.longitude,
      latitudeDelta: 0.005,
      longitudeDelta: 0.005,
    };
  }, [centroidRef.current]);

  const centerOnParcel = () => {
    if (mainParcelRings.length > 0) {
      fitMapToParcel();
      return;
    }
    if (mapRef.current && centroidRef.current) {
      const region = {
        latitude: centroidRef.current.latitude,
        longitude: centroidRef.current.longitude,
        latitudeDelta: 0.008,
        longitudeDelta: 0.008,
      };
      mapRef.current.animateToRegion?.(region, 600) || mapRef.current.animateCamera?.({ center: { latitude: region.latitude, longitude: region.longitude }, zoom: 16 }, { duration: 600 });
    }
  };

  const openInGoogleMaps = () => {
    const centroid = centroidRef.current;
    if (!centroid) return;
    const lat = centroid.latitude;
    const lng = centroid.longitude;
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    const appleMapsUrl = `http://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`;
    const url = Platform.OS === 'ios' ? appleMapsUrl : googleMapsUrl;
    Linking.openURL(url).catch(() => Linking.openURL(googleMapsUrl).catch(() => {}));
  };

  const onMapReady = useCallback(() => {
    setMapReady(true);
    setTimeout(() => fitMapToParcel(), 500);
  }, []);

  const fitMapToParcel = useCallback(() => {
    if (!mapRef.current) return;
    // compute the main geometry to include
    const mainGeom = geometry || (parcel && parcel.geometry) || null;
    const allCoordinates = collectFitCoordinates(mainGeom, showNeighbors ? neighborParcels : []);
    try { console.debug && console.debug('fitMapToParcel allCoordinates length', allCoordinates.length, 'showNeighbors', showNeighbors, 'neighborParcels', neighborParcels.length); } catch (e) {}

    // If we have too few points or none, fallback to centroid-based zoom to avoid world zoom-out
    if (allCoordinates.length >= 3) {
      const padding = showNeighbors ? { top: 50, right: 50, bottom: 50, left: 50 } : { top: 20, right: 20, bottom: 20, left: 20 };
      try {
        mapRef.current.fitToCoordinates(allCoordinates, { edgePadding: padding, animated: true });
        return;
      } catch (e) {
        console.warn('fitToCoordinates failed, falling back to centroid', e);
      }
    }

    // Fallback: center on centroid and set a reasonable zoom
    if (centroidRef.current) {
      const region = {
        latitude: centroidRef.current.latitude,
        longitude: centroidRef.current.longitude,
        latitudeDelta: 0.008,
        longitudeDelta: 0.008,
      };
      try {
        mapRef.current.animateToRegion?.(region, 600) || mapRef.current.animateCamera?.({ center: { latitude: region.latitude, longitude: region.longitude }, zoom: 16 }, { duration: 600 });
        try { console.debug && console.debug('fitMapToParcel used centroid fallback', centroidRef.current); } catch (e) {}
      } catch (e) {
        console.warn('centroid fallback animate failed', e);
      }
    } else {
      try { console.debug && console.debug('fitMapToParcel: no centroid available to fallback to'); } catch (e) {}
    }
  }, [mainParcelRings, neighborParcels, showNeighbors, geometry, parcel]);

  useEffect(() => {
    if (mapReady) {
      const t = setTimeout(fitMapToParcel, 120);
      return () => clearTimeout(t);
    }
  }, [showNeighbors, neighborParcels, mapReady, fitMapToParcel]);

  const renderPersonnePhysique = (props: any) => (
    <Card style={styles.card}>
      <Card.Content>
        <View style={styles.cardHeader}>
          <SafeIonicons name="person" size={24} color="#2196F3" />
          <Text style={styles.cardTitle}>Informations Personnelles</Text>
        </View>
        <Divider style={styles.divider} />
        <View style={styles.infoRow}><Text style={styles.label}>Prénom:</Text><Text style={styles.value}>{displayValue(props?.Prenom)}</Text></View>
        <View style={styles.infoRow}><Text style={styles.label}>Nom:</Text><Text style={styles.value}>{displayValue(props?.Nom)}</Text></View>
        <View style={styles.infoRow}><Text style={styles.label}>Sexe:</Text><Text style={styles.value}>{displayValue(props?.Sexe)}</Text></View>
        <View style={styles.infoRow}><Text style={styles.label}>Situation matrimoniale:</Text><Text style={styles.value}>{displayValue(props?.Situa_mat)}</Text></View>
        <View style={styles.infoRow}><Text style={styles.label}>Date de naissance:</Text><Text style={styles.value}>
          {(() => {
            const fromMand = pickMandField(['Date_naiss','Date_nais','Dat_naiss','Dat_naiss1','Date_nai','Date_naissance','Date_de_naissance'], undefined, props);
            if (fromMand) return formatDateWithAge(fromMand);
            const found = findDateInProps(props, propsObj) || getValueOrFallback(props, 'Date_naiss', '') || getValueOrFallback(propsObj, 'Date_naiss', '');
            return formatDateWithAge(found);
          })()}
        </Text></View>
        <View style={styles.infoRow}><Text style={styles.label}>Lieu de naissance:</Text><Text style={styles.value}>{displayValue(props?.Lieu_naiss)}</Text></View>
        <View style={styles.infoRow}><Text style={styles.label}>Type de pièce:</Text><Text style={styles.value}>{displayValue(props?.Type_piece)}</Text></View>
        <View style={styles.infoRow}><Text style={styles.label}>Numéro de pièce:</Text><Text style={styles.value}>{displayValue(props?.Num_piece)}</Text></View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Téléphone:</Text>
          <TouchableOpacity onPress={() => dialNumber(props?.Telephone)}>
            <Text style={[styles.value, props?.Telephone && styles.affPhoneLink]}>{displayValue(props?.Telephone)}</Text>
          </TouchableOpacity>
        </View>
      </Card.Content>
    </Card>
  );

  const renderPersonneMorale = (props: any) => (
    <Card style={styles.card}>
      <Card.Content>
        <View style={styles.cardHeader}>
          <SafeIonicons name="business" size={24} color="#4CAF50" />
          <Text style={styles.cardTitle}>Informations Entreprise</Text>
        </View>
        <Divider style={styles.divider} />
        <View style={styles.infoRow}><Text style={styles.label}>Dénomination:</Text><Text style={styles.value}>{displayValue(props?.Denominat)}</Text></View>
        <View style={styles.infoRow}><Text style={styles.label}>Mandataire:</Text><Text style={styles.value}>{displayValue(props?.Mandataire)}</Text></View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Téléphone:</Text>
          <TouchableOpacity onPress={() => dialNumber(getBestValue([props?.Telephone_001, props?.Telephone]))}>
            <Text style={[styles.value, styles.affPhoneLink]}>{getBestValue([props?.Telephone_001, props?.Telephone])}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.infoRow}><Text style={styles.label}>Numéro de pièce:</Text><Text style={styles.value}>{displayValue(props?.Num_piece)}</Text></View>
      </Card.Content>
    </Card>
  );

  const renderParcelInfo = (props: any) => (
    (() => {
      try {
  const v = getCanonicalValue(props, normalizedProps || props, 'Vocation');
  const t = getCanonicalValue(props, normalizedProps || props, 'type_usag');
  console.debug && console.debug('renderParcelInfo props keys', Object.keys(props || {}).slice(0,40), 'canonical Vocation->', v, 'canonical type_usag->', t);
      } catch (e) {}
      return (
        <ParcelInfo
          numParcel={props?.Num_parcel}
          village={getValueOrFallback(props, 'Village')}
          region={getValueOrFallback(props, 'regionSenegal') || getValueOrFallback(props, 'Region') || getValueOrFallback(props, 'region')}
          department={getValueOrFallback(props, 'departmentSenegal') || getValueOrFallback(props, 'Department') || getValueOrFallback(props, 'department')}
          arrondissement={getValueOrFallback(props, 'arrondissementSenegal') || getValueOrFallback(props, 'Arrondissement') || getValueOrFallback(props, 'arrondissement')}
          commune={getValueOrFallback(props, 'communeSenegal') || getValueOrFallback(props, 'Commune') || getValueOrFallback(props, 'commune')}
          grappe={getValueOrFallback(props, 'grappeSenegal') || getValueOrFallback(props, 'Grappe') || getValueOrFallback(props, 'grappe')}
          vocation={getCanonicalValue(props, normalizedProps || props, 'Vocation')}
          typeUsage={getCanonicalValue(props, normalizedProps || props, 'type_usag')}
        />
      );
    })()
  );

  const renderParcelCollectif = (props: any) => {
    const affListRaw = normalizedProps?.affectataires?.length ? normalizedProps.affectataires : (affectatairesMerged ? String(affectatairesMerged.Prenom || '').split('\n').map((p,i)=>({
      prenom: p.trim(),
      nom: String(affectatairesMerged.Nom||'').split('\n')[i]?.trim() || '',
      numero_piece: String(affectatairesMerged.Numero_piece||'').split('\n')[i]?.trim() || '',
      telephone: String(affectatairesMerged.Telephone||'').split('\n')[i]?.trim() || '',
      date_naiss: String(affectatairesMerged.Date_naissance||'').split('\n')[i]?.trim() || '',
      residence: String(affectatairesMerged.Residence||'').split('\n')[i]?.trim() || '',
      sexe: String(affectatairesMerged.Sexe||'').split('\n')[i]?.trim() || ''
    })) : []);

    const indexedAffList = useMemo(() => {
      if (affListRaw.length > 0) return affListRaw;
  const list: Array<{ prenom: string; nom: string; numero_piece: string; telephone: string; date_naiss: string; residence: string; sexe: string; }> = [];
      const pick = (keys: string[], fieldNameHint: string, idx: number) => {
        for (const k of keys) {
          if (propsObj?.[k] && String(propsObj[k]).trim() !== '-') return String(propsObj[k]).trim();
        }
        const re = new RegExp(`${fieldNameHint}[_-]?(?:0*)${idx}|(?:0*)${idx}[_-]?${fieldNameHint}`, 'i');
        for (const key of Object.keys(propsObj || {})) {
          if (re.test(key) && propsObj[key] && String(propsObj[key]).trim() !== '-') return String(propsObj[key]).trim();
        }
        return '';
      };
  for (let idx = 1; idx <= 27; idx++) {
        const i2 = String(idx).padStart(2, '0');
        const prenom = pick([`Prenom_${i2}`, `Prenom_${idx}`, `prenom_${i2}`, `Prenom_${i2}_COL`, `Prenom_${i2}_col`], 'prenom', idx);
        const nom = pick([`Nom_${i2}`, `Nom_${idx}`, `nom_${i2}`, `Nom_${i2}_COL`, `Nom_${i2}_col`], 'nom', idx);
        const numero_piece = pick([`Num_piece_${i2}`, `Num_piece_${idx}`, `Numero_piece_${i2}`, `Numero_piece_${idx}`, `Num_piec_${i2}`, `Num_piec_${idx}`], 'num', idx);
        const telephone = pick([`Telephone_${i2}`, `Telephone_${idx}`, `Telephon2_${i2}`, `Telephon2_${idx}`, `Telephone_${i2}_COL`], 'telephone', idx);
        const date_naiss = pick([`Date_naissance_${i2}`, `Date_naiss_${i2}`, `Date_naiss_${idx}`, `Date_naissance_${idx}`], 'date', idx);
        const residence = pick([`Residence_${i2}`, `Residence_${idx}`, `residence_${i2}`], 'residence', idx);
        const sexe = pick([`Sexe_${i2}`, `Sexe_${idx}`, `sexe_${i2}`], 'sexe', idx);
        if (prenom || nom || numero_piece || telephone || date_naiss || residence) {
          list.push({ prenom, nom, numero_piece, telephone, date_naiss, residence, sexe });
        }
      }
      return list;
    }, [affListRaw, propsObj]);

  const affList = useMemo(() => indexedAffList.filter((a: { prenom?: string; nom?: string; numero_piece?: string; telephone?: string; date_naiss?: string; residence?: string }) => a.prenom || a.nom || a.numero_piece || a.telephone || a.date_naiss || a.residence), [indexedAffList]);

    const affCount = normalizedProps?.affectatairesCount ?? (affectatairesMerged ? String(affectatairesMerged.Prenom || '').split('\n').filter(Boolean).length : affList.length || 0);

    const mandPrenom = pickMandField(['Prenom_M','Prenom','prenom','Prenom_Mndt'], 'prenom', props) || 'Non disponible';
    const mandNom = pickMandField(['Nom_M','Nom','nom'], 'nom', props) || 'Non disponible';
    const mandDateRaw = pickMandField(['Date_naiss','Date_naissance','Date_nai','Date_naiss_M'], undefined, props) || '';
    const mandDate = parseToDate(mandDateRaw);
    const mandAge = mandDate ? `${calculateAge(mandDate) ?? 'Non disponible'} ans` : displayValue(props?.Age || propsObj?.Age, 'Non disponible');
    const mandSexe = pickMandField(['Sexe_Mndt','Sexe','sexe'], undefined, props) || 'Non disponible';
    const mandNumero = pickMandField(['Num_piec','Numero_piece','Numero','Num_piece','num_piece'], undefined, props) || 'Non disponible';
    const mandTelRaw = getBestValue([normalizedProps?.mandataire?.telephone, props?.Telephon2, propsObj?.Telephon2, String(affectatairesMerged?.Telephone || '').split('\n')[0]], 'Non spécifié');
    const mandResidence = getBestValue([props?.Lieu_nais, propsObj?.Lieu_nais, props?.Lieu_resi2, propsObj?.Lieu_resi2, String(affectatairesMerged?.Residence || '').split('\n')[0]], 'Non disponible');

    if (__DEV__) {
      console.debug('Mandataire resolved', { mandPrenom, mandNom, mandDateRaw, mandAge, mandSexe, mandNumero, mandTelRaw });
    }

    return (
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.cardHeader}>
            <SafeIonicons name="people" size={24} color="#FF9800" />
            <Text style={styles.cardTitle}>Parcelle Collective</Text>
          </View>
          <Divider style={styles.divider} />
          <MandataireInfo
            prenom={mandPrenom}
            nom={mandNom}
            age={mandAge}
            sexe={mandSexe}
            residence={displayValue(normalizedProps?.mandataire?.lieu ?? mandResidence)}
            numPiece={mandNumero}
            telephone={mandTelRaw !== 'Non spécifié' ? mandTelRaw : undefined}
            onCallPress={dialNumber}
          />
          {affList.length > 0 && (
            <View style={styles.affectatairesContainer}>
              <View style={styles.affectatairesHeader}>
                <View style={styles.affectatairesTitle}>
                  <SafeIonicons name="people" size={22} color="#A02020" />
                  <Text style={styles.affectatairesHeaderText}>Affectataires</Text>
                  <View style={styles.affCountBadge}>
                    <Text style={styles.affCountText}>{affCount}</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => setAffectatairesExpanded(!affectatairesExpanded)} style={styles.expandButton}>
                  <SafeIonicons name={affectatairesExpanded ? 'chevron-up' : 'chevron-down'} size={24} color="#666" />
                </TouchableOpacity>
              </View>
              {!affectatairesExpanded ? (
                (() => {
                  const first = affList[0] || {};
                  const name = [first.prenom || '', first.nom || ''].filter(Boolean).join(' ') || 'N/A';
                  const phone = first?.telephone || '';
                  const id = first?.numero_piece || '';
                  const residence = first?.residence || '';
                  return (
                    <AffectataireSummary
                      testID="affectataires-preview"
                      name={name}
                      phone={phone || undefined}
                      id={id || undefined}
                      residence={residence || undefined}
                      onPress={() => setAffectatairesExpanded(true)}
                    />
                  );
                })()
              ) : (
                <FlatList
                  data={affList}
                  keyExtractor={(_, index) => `aff-expanded-${index}`}
                  contentContainerStyle={styles.affListContent}
                  style={styles.affListScrollable}
                  nestedScrollEnabled={true}
                  initialNumToRender={10}
                  renderItem={({ item, index }) => {
                    const name = [item.prenom || '', item.nom || ''].filter(Boolean).join(' ') || 'N/A';
                    const tel = item.telephone || '';
                    const dob = item.date_naiss || '';
                    const residence = item.residence || '';
                    const numero = item.numero_piece || '';
                    const sexe = item.sexe || '';
                    return (
                      <View style={styles.affItem}>
                        <View style={styles.affHeaderRow}>
                          <View style={styles.affIndexCircle}>
                            <Text style={styles.affIndexText}>{index + 1}</Text>
                          </View>
                          <Text style={styles.affFullName} numberOfLines={2}>
                            {name}{sexe ? ` (${sexe})` : ''}
                          </Text>
                        </View>
                        <View style={styles.affDetailsGrid}>
                          {numero && (
                            <View style={[styles.affDetailRow, styles.affDetailFullWidth]}>
                              <SafeIonicons name="card-outline" size={16} color="#666" />
                              <Text style={styles.affDetailText}>ID: {numero}</Text>
                            </View>
                          )}
                          {tel && (
                            <TouchableOpacity style={styles.affDetailRow} onPress={() => dialNumber(tel)}>
                              <SafeIonicons name="call-outline" size={16} color="#A02020" />
                              <Text style={[styles.affDetailText, styles.phoneLink]}>{tel}</Text>
                            </TouchableOpacity>
                          )}
                          {dob && (
                            <View style={styles.affDetailRow}>
                              <SafeIonicons name="calendar-outline" size={16} color="#666" />
                              <Text style={styles.affDetailText}>{new Date(dob).toLocaleDateString()}</Text>
                            </View>
                          )}
                          {residence && (
                            <View style={[styles.affDetailRow, styles.affDetailFullWidth]}>
                              <SafeIonicons name="home-outline" size={16} color="#666" />
                              <Text style={styles.affDetailText} numberOfLines={2}>{residence}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    );
                  }}
                />
              )}
              <Modal visible={showAffectatairesModal} animationType="fade" transparent={true} onRequestClose={() => setShowAffectatairesModal(false)}>
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowAffectatairesModal(false)}>
                  <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
                    <View style={styles.modalHeader}>
                      <Text style={styles.modalTitle}>Affectataires</Text>
                      <TouchableOpacity onPress={() => setShowAffectatairesModal(false)}>
                        <SafeIonicons name="close" size={24} color="#333" />
                      </TouchableOpacity>
                    </View>
                    <FlatList
                      data={affList}
                      keyExtractor={(_, index) => `aff-modal-${index}`}
                      contentContainerStyle={styles.affListContent}
                      nestedScrollEnabled={true}
                      initialNumToRender={10}
                      maxToRenderPerBatch={5}
                      renderItem={({ item, index }) => {
                        const name = [item.prenom || '', item.nom || ''].filter(Boolean).join(' ') || 'N/A';
                        const tel = item.telephone || '';
                        const dob = item.date_naiss || '';
                        const residence = item.residence || '';
                        const numero = item.numero_piece || '';
                        const sexe = item.sexe || '';
                        return (
                          <View style={styles.affItem}>
                            <View style={styles.affHeaderRow}>
                              <View style={styles.affIndexCircle}>
                                <Text style={styles.affIndexText}>{index + 1}</Text>
                              </View>
                              <Text style={styles.affFullName} numberOfLines={2}>
                                {name}{sexe ? ` (${sexe})` : ''}
                              </Text>
                            </View>
                            <View style={styles.affDetailsGrid}>
                              {numero && (
                                <View style={[styles.affDetailRow, styles.affDetailFullWidth]}>
                                  <SafeIonicons name="card-outline" size={16} color="#666" />
                                  <Text style={styles.affDetailText}>ID: {numero}</Text>
                                </View>
                              )}
                              {tel && (
                                <TouchableOpacity style={styles.affDetailRow} onPress={() => dialNumber(tel)}>
                                  <SafeIonicons name="call-outline" size={16} color="#A02020" />
                                  <Text style={[styles.affDetailText, styles.phoneLink]}>{tel}</Text>
                                </TouchableOpacity>
                              )}
                              {dob && (
                                <View style={styles.affDetailRow}>
                                  <SafeIonicons name="calendar-outline" size={16} color="#666" />
                                  <Text style={styles.affDetailText}>{new Date(dob).toLocaleDateString()}</Text>
                                </View>
                              )}
                              {residence && (
                                <View style={[styles.affDetailRow, styles.affDetailFullWidth]}>
                                  <SafeIonicons name="home-outline" size={16} color="#666" />
                                  <Text style={styles.affDetailText} numberOfLines={2}>{residence}</Text>
                                </View>
                              )}
                            </View>
                          </View>
                        );
                      }}
                    />
                  </View>
                </TouchableOpacity>
              </Modal>
            </View>
          )}
        </Card.Content>
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ParcelDetailErrorBoundary>
        <ScrollView style={styles.container} ref={scrollRef} contentContainerStyle={{ flexGrow: 1 }} removeClippedSubviews={true}>
          {!dbError && !parcel && Object.keys(propsObj).length === 0 && (
            <View style={[styles.card, { backgroundColor: '#fff3cd', borderLeftWidth: 4, borderLeftColor: '#ff9800' }]}>
              <Text style={{ color: '#8a6d3b', fontWeight: '600' }}>Chargement de la parcelle...</Text>
            </View>
          )}
          {dbError ? (
            <View style={styles.card}>
              <SafeIonicons name="alert-circle-outline" size={48} color="#E65100" style={{ alignSelf: 'center', marginBottom: 12 }} />
              <Text style={{ color: '#E65100', fontSize: 16, textAlign: 'center' }}>{dbError}</Text>
            </View>
          ) : (
            <>
              {showMap ? (
                <View style={styles.mapCard}>
                  {mainParcelRings.length > 0 ? (
                    <MapView
                      ref={mapRef}
                      style={styles.map}
                      initialRegion={mapRegion}
                      onMapReady={onMapReady}
                      provider={mapProvider as any}
                      mapType="hybrid"
                      zoomEnabled
                      pitchEnabled
                      rotateEnabled
                      scrollEnabled
                    >
                      {mainParcelRings.map((coords, idx) => (
                        <Polygon key={`main-${idx}`} coordinates={coords} fillColor="rgba(33, 150, 243, 0.6)" strokeColor="#0d47a1" strokeWidth={4} zIndex={5} />
                      ))}
                      {showNeighbors && neighborParcels.map((neighbor, nIdx) => {
                        try {
                          let g = neighbor?.__parsedGeometry ?? neighbor?.geometry ?? neighbor?.geometry_string ?? neighbor?.geom;
                          if (typeof g === 'string') g = safeParseJSON(g) || null;
                          if (!g || typeof g !== 'object') return null;
                          let coords: { latitude: number; longitude: number }[] | null = null;
                          let marker: { latitude: number; longitude: number } | null = null;
                          if (g.type === 'Polygon' && Array.isArray(g.coordinates) && Array.isArray(g.coordinates[0])) {
                            coords = sanitizeCoords(g.coordinates[0]);
                          } else if (g.type === 'MultiPolygon' && Array.isArray(g.coordinates) && Array.isArray(g.coordinates[0]) && Array.isArray(g.coordinates[0][0])) {
                            coords = sanitizeCoords(g.coordinates[0][0]);
                          }
                          if (!Array.isArray(coords) || coords.length === 0) return null;
                          if (coords.length > 1800) coords = decimateCoords(coords);
                          // compute centroid for marker
                          let latSum = 0, lngSum = 0;
                          coords.forEach(c => { latSum += c.latitude; lngSum += c.longitude; });
                          marker = { latitude: latSum / coords.length, longitude: lngSum / coords.length };
                          return (
                            <React.Fragment key={`nbr-${nIdx}`}>
                              <Polygon coordinates={coords} fillColor="rgba(76, 175, 80, 0.25)" strokeColor="#1b5e20" strokeWidth={2} zIndex={3} tappable onPress={() => handleNeighborPress(neighbor)} />
                              {marker && (
                                <Marker coordinate={marker} tracksViewChanges={false} onPress={() => handleNeighborPress(neighbor)}>
                                  <View style={{ backgroundColor: 'white', padding: 4, borderRadius: 6, borderWidth: 1, borderColor: '#1b5e20' }}>
                                    <Text style={{ fontSize: 10, fontWeight: '700' }}>{neighbor.num_parcel || neighbor.num_parc || neighbor.id}</Text>
                                  </View>
                                </Marker>
                              )}
                            </React.Fragment>
                          );
                        } catch (e) {
                          console.warn('Error rendering neighbor parcel', e);
                          return null;
                        }
                      })}
                      {centroidRef.current && (
                        <Marker coordinate={centroidRef.current} tracksViewChanges={false}>
                          <View style={{ backgroundColor: 'rgba(255,255,255,0.9)', padding: 6, borderRadius: 6 }}>
                            <Text style={{ fontSize: 10, fontWeight: '700' }}>{parcel?.num_parcel}</Text>
                          </View>
                        </Marker>
                      )}
                    </MapView>
                  ) : (
                    <View style={styles.noGeometryContainer}>
                      <Text style={styles.noGeometryText}>Géométrie non disponible pour cette parcelle.</Text>
                      {__DEV__ && (
                        <>
                          <Text style={styles.debugText}>Debug: Geometry type: {geometry?.type || 'undefined'}</Text>
                          <Text style={styles.debugText}>Coordinates available: {geometry?.coordinates ? 'Yes' : 'No'}</Text>
                        </>
                      )}
                    </View>
                  )}
                  <View pointerEvents="box-none" style={styles.mapOverlayContainer}>
                    <View pointerEvents="auto" style={styles.mapOverlayTopRight}>
                      <MapControls
                        onCenterParcel={centerOnParcel}
                        onToggleNeighbors={() => setShowNeighbors(prev => !prev)}
                        onToggleMap={() => setShowMap(false)}
                        showNeighbors={showNeighbors}
                        showMap={showMap}
                        onNavigate={openInGoogleMaps}
                        navigateDisabled={!centroidRef.current}
                      />
                    </View>
                  </View>
                </View>
              ) : (
                <View style={styles.card}>
                  <TouchableOpacity style={styles.showMapButton} onPress={() => setShowMap(true)}>
                    <Text style={{ color: '#A02020', fontWeight: '700', fontSize: 16 }}>Afficher la carte</Text>
                  </TouchableOpacity>
                </View>
              )}
              {renderParcelInfo(propsObj)}
              {parcel?.parcel_type === 'individuel'
                ? (propsObj?.Typ_pers === 'personne_morale' ? renderPersonneMorale(propsObj) : renderPersonnePhysique(propsObj))
                : renderParcelCollectif(propsObj)}
              {showNeighbors && (
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <SafeIonicons name="layers" size={22} color="#388e3c" />
                    <Text style={styles.cardTitle}>Parcelles voisines {loadingNeighbors ? '(chargement...)' : `(${neighborParcels.length})`}</Text>
                  </View>
                  <View style={styles.dividerLine} />
                  {loadingNeighbors ? (
                    <View style={{ padding: 15, alignItems: 'center' }}>
                      <ActivityIndicator size="small" color="#388e3c" />
                      <Text style={{ marginTop: 10, color: '#666' }}>Chargement des parcelles voisines...</Text>
                    </View>
                  ) : neighborParcels.length === 0 ? (
                    <View style={{ padding: 15, alignItems: 'center' }}>
                      <Text style={{ color: '#666' }}>Aucune parcelle voisine trouvée</Text>
                      {spatialDbBroken && (
                        <Text style={{ color: '#E65100', marginTop: 8, fontSize: 12 }}>Recherche spatiale indisponible.</Text>
                      )}
                    </View>
                  ) : (
                    neighborParcels.map((neighbor, idx) => {
                      const getNeighborName = () => {
                        if (neighbor.parcel_type === 'individuel') {
                          if (neighbor.typ_pers === 'personne_morale') return displayValue(neighbor.denominat);
                          return `${displayValue(neighbor.prenom)} ${displayValue(neighbor.nom)}`.trim() || 'Non spécifié';
                        }
                        return getBestValue([
                          `${neighbor.prenom_m || ''} ${neighbor.nom_m || ''}`.trim(),
                          neighbor.denominat,
                          `Mandataire: ${neighbor.prenom_m || ''} ${neighbor.nom_m || ''}`
                        ]);
                      };
                      return (
                        <TouchableOpacity
                          key={neighbor.id || neighbor.num_parcel || `neighbor-${idx}`}
                          onPress={() => handleNeighborPress(neighbor)}
                          style={{
                            paddingVertical: 12,
                            paddingHorizontal: 16,
                            borderBottomWidth: idx < neighborParcels.length - 1 ? 1 : 0,
                            borderBottomColor: '#e0e0e0',
                            flexDirection: 'row',
                            alignItems: 'center',
                            backgroundColor: idx % 2 === 0 ? '#f9f9f9' : 'white',
                          }}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.label, { color: neighbor.parcel_type === 'collectif' ? '#4CAF50' : '#2196F3', fontSize: 16, marginBottom: 4, fontWeight: '600' }]}>
                              {neighbor.num_parcel}
                            </Text>
                            <Text style={styles.value}>{getNeighborName()}</Text>
                            {neighbor.village && <Text style={[styles.value, { color: '#888', fontSize: 12 }]}>{displayValue(neighbor.village)}</Text>}
                            <View style={{
                              backgroundColor: neighbor.parcel_type === 'collectif' ? '#E8F5E9' : '#E3F2FD',
                              paddingVertical: 2,
                              paddingHorizontal: 6,
                              borderRadius: 4,
                              alignSelf: 'flex-start',
                              marginTop: 4
                            }}>
                              <Text style={{ fontSize: 11, color: neighbor.parcel_type === 'collectif' ? '#2E7D32' : '#1565C0' }}>
                                {neighbor.parcel_type === 'collectif' ? 'Collectif' : 'Individuel'}
                              </Text>
                            </View>
                          </View>
                          <SafeIonicons name="chevron-forward" size={24} color="#bdbdbd" />
                        </TouchableOpacity>
                      );
                    })
                  )}
                </View>
              )}
              <TouchableOpacity 
                style={[styles.complaintButton, { paddingBottom: Math.max(12, insets.bottom + 8) }]}
                onPress={() => {
                  const num = propsObj?.Num_parcel || propsObj?.num_parcel || parcel?.num_parcel || '';
                  const village = propsObj?.Village || propsObj?.village || parcel?.village || '';
                  navigation.navigate('ComplaintWizard', { parcel: { ...(parcel || {}), num_parcel: num, village, properties: propsObj } });
                }}
              >
                <Text style={styles.complaintButtonText}>Déposer une réclamation</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </ParcelDetailErrorBoundary>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f5f5f5' },
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  mapCard: { margin: 16, marginBottom: 8, elevation: 4, borderRadius: 8, backgroundColor: '#fff', overflow: 'hidden' },
  map: { width: '100%', height: 360 },
  mapOverlayContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, pointerEvents: 'box-none' },
  mapOverlayTopRight: { position: 'absolute', top: 12, right: 12, zIndex: 10000, padding: 6 },
  card: { margin: 16, marginBottom: 8, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginLeft: 8, flex: 1 },
  divider: { marginVertical: 12 },
  dividerLine: { height: 1, backgroundColor: '#e0e0e0', marginVertical: 12 },
  infoRow: { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-start' },
  label: { fontSize: 14, fontWeight: '600', color: '#666', width: 140, marginRight: 12 },
  value: { fontSize: 14, color: '#333', flex: 1, lineHeight: 20 },
  showMapButton: { borderWidth: 1, borderColor: '#A02020', borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginVertical: 8 },
  noGeometryContainer: { padding: 16 },
  noGeometryText: { color: '#f44336', marginTop: 16 },
  debugText: { color: '#666', marginTop: 8, fontSize: 12 },
  affPhoneLink: { color: '#A02020' },
  affectatairesContainer: { marginTop: 12, backgroundColor: '#fff', borderRadius: 8, overflow: 'hidden', elevation: 1 },
  affectatairesHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 16, backgroundColor: '#f5f5f5' },
  affectatairesTitle: { flexDirection: 'row', alignItems: 'center' },
  affectatairesHeaderText: { fontSize: 16, fontWeight: 'bold', color: '#A02020', marginLeft: 8 },
  affCountBadge: { backgroundColor: '#A02020', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2, marginLeft: 8 },
  affCountText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  expandButton: { padding: 4, borderRadius: 20, backgroundColor: '#f5f5f5', width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  affListContent: { padding: 12 },
  affListScrollable: { maxHeight: 300 },
  affItem: { marginBottom: 16, backgroundColor: '#f9f9f9', borderRadius: 8, padding: 12 },
  affHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  affIndexCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#A02020', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  affIndexText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  affFullName: { flex: 1, fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  affDetailsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingLeft: 40 },
  affDetailRow: { flexDirection: 'row', alignItems: 'center', marginRight: 16, marginBottom: 10, width: '45%', minHeight: 26 },
  affDetailFullWidth: { width: '95%' },
  affDetailText: { flex: 1, fontSize: 14, color: '#666', marginLeft: 6 },
  complaintButton: { margin: 16, backgroundColor: '#A02020', borderRadius: 8, paddingVertical: 16, alignItems: 'center', elevation: 3 },
  complaintButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  phoneLink: { color: '#A02020', textDecorationLine: 'underline' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '90%', maxHeight: '80%', backgroundColor: 'white', borderRadius: 10, padding: 0, overflow: 'hidden', elevation: 5 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  modalTitle: { fontSize: 18, fontWeight: '700' },
});

export default ParcelDetailScreen;