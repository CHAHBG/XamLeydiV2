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
  InteractionManager,
} from 'react-native';
import MapView, { Polygon, Marker } from 'react-native-maps';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeIonicons } from '../components/SafeIcons';
import { EnhancedCard, StatsCard, Badge, EnhancedButton } from '../ui/components';
import theme from '../ui/theme';
import DatabaseManager from '../data/database';
import normalizeProperties from '../utils/normalizeProperties';
import { collectFitCoordinates } from '../utils/mapUtils';
import MapControls from '../ui/molecules/MapControls';

const { width: screenWidth } = Dimensions.get('window');

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
  }, []);
}

// Decimate coords
function decimateCoords(coords: { latitude: number; longitude: number }[], maxPoints = 800) {
  if (!Array.isArray(coords)) return [];
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
  try { return JSON.parse(raw); } catch { return null; }
}

interface ModernParcelDetailScreenProps {
  route: any;
  navigation: any;
  dbReady?: boolean;
}

export default function ModernParcelDetailScreen({ route, navigation, dbReady: parentDbReady }: ModernParcelDetailScreenProps) {
  const params = route?.params || {};
  const { parcel, geometry, properties } = params;
  const insets = useSafeAreaInsets();

  const [propsObj, setPropsObj] = useState<any>(() => {
    if (properties && typeof properties === 'object') return properties;
    if (parcel) return parcel;
    return {};
  });

  const [normalizedProps, setNormalizedProps] = useState<any>(null);
  const [mainParcelRings, setMainParcelRings] = useState<any[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [showMap, setShowMap] = useState(true);
  const [showNeighbors, setShowNeighbors] = useState(false);
  const [neighborParcels, setNeighborParcels] = useState<any[]>([]);
  const [loadingNeighbors, setLoadingNeighbors] = useState(false);
  const [dbReady, setDbReady] = useState(!!parentDbReady);
  const [expandedSections, setExpandedSections] = useState({
    personal: true,
    location: true,
    affectataires: false,
  });

  const mapRef = useRef<any>(null);
  const centroidRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const attemptedDbGeometryRef = useRef(false);

  useEffect(() => {
    if (propsObj && Object.keys(propsObj).length > 0) {
      InteractionManager.runAfterInteractions(() => {
        const normalized = normalizeProperties(propsObj);
        if (normalized) setNormalizedProps(normalized);
      });
    }
  }, [propsObj]);

  useEffect(() => {
    let cancelled = false;
    let raw = geometry || (parcel && parcel.geometry) || null;
    
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
        firstRing.forEach((p: { latitude: number; longitude: number }) => { 
          const lat = Number(p.latitude); 
          const lon = Number(p.longitude); 
          if (isFinite(lat) && isFinite(lon)) { latSum += lat; lonSum += lon; }
        });
        centroidRef.current = { latitude: latSum / firstRing.length, longitude: lonSum / firstRing.length };
      }
      setMainParcelRings(rings);
    };

    if (typeof raw === 'string') {
      InteractionManager.runAfterInteractions(() => {
        if (cancelled) return;
        const geom = safeParseJSON(raw);
        if (geom) parseAndSet(geom);
      });
    } else if (raw) {
      parseAndSet(raw);
    }
    
    return () => { cancelled = true; };
  }, [geometry, parcel]);

  const displayValue = useCallback((v: any, fallback = 'Non disponible') => {
    if (v === undefined || v === null) return fallback;
    const s = String(v).trim();
    if (!s || s === '-' || s.toLowerCase() === 'null') return fallback;
    return s;
  }, []);

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
    } catch {
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
    if (mapRef.current && centroidRef.current) {
      const region = {
        latitude: centroidRef.current.latitude,
        longitude: centroidRef.current.longitude,
        latitudeDelta: 0.008,
        longitudeDelta: 0.008,
      };
      mapRef.current.animateToRegion?.(region, 600);
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
    setTimeout(() => {
      if (mapRef.current && centroidRef.current) {
        const region = {
          latitude: centroidRef.current.latitude,
          longitude: centroidRef.current.longitude,
          latitudeDelta: 0.008,
          longitudeDelta: 0.008,
        };
        mapRef.current.animateToRegion?.(region, 600);
      }
    }, 500);
  }, []);

  const renderPersonalInfo = () => {
    const isCollective = parcel?.parcel_type === 'collectif';
    
    if (isCollective) {
      return (
        <EnhancedCard style={{ marginBottom: theme.spacing(2) }}>
          <View style={styles.sectionHeader}>
            <SafeIonicons name="people" size={24} color={theme.colors.warning} />
            <Text style={styles.sectionTitle}>Parcelle Collective</Text>
            <Badge label="Collectif" variant="warning" icon="people" />
          </View>

          <View style={styles.divider} />

          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <View style={styles.iconCircle}>
                <SafeIonicons name="person" size={18} color={theme.colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.infoLabel}>Mandataire</Text>
                <Text style={styles.infoValue}>
                  {displayValue(propsObj?.Prenom_M)} {displayValue(propsObj?.Nom_M)}
                </Text>
              </View>
            </View>

            <View style={styles.infoItem}>
              <View style={styles.iconCircle}>
                <SafeIonicons name="male-female" size={18} color={theme.colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.infoLabel}>Sexe</Text>
                <Text style={styles.infoValue}>{displayValue(propsObj?.Sexe_Mndt)}</Text>
              </View>
            </View>

            <View style={styles.infoItem}>
              <View style={styles.iconCircle}>
                <SafeIonicons name="card" size={18} color={theme.colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.infoLabel}>Pièce d'identité</Text>
                <Text style={styles.infoValue}>{displayValue(propsObj?.Num_piec)}</Text>
              </View>
            </View>

            {propsObj?.Telephon2 && (
              <View style={styles.infoItem}>
                <TouchableOpacity onPress={() => dialNumber(propsObj?.Telephon2)} style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <View style={styles.iconCircle}>
                    <SafeIonicons name="call" size={18} color={theme.colors.success} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.infoLabel}>Téléphone</Text>
                    <Text style={[styles.infoValue, styles.phoneLink]}>{displayValue(propsObj?.Telephon2)}</Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.infoItem}>
              <View style={styles.iconCircle}>
                <SafeIonicons name="people-circle" size={18} color={theme.colors.warning} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.infoLabel}>Nombre d'affectataires</Text>
                <Text style={styles.infoValue}>{normalizedProps?.affectatairesCount || 0}</Text>
              </View>
            </View>
          </View>
        </EnhancedCard>
      );
    }

    // Individual parcel
    const isPersonneMorale = propsObj?.Typ_pers === 'personne_morale';
    
    return (
      <EnhancedCard style={{ marginBottom: theme.spacing(2) }}>
        <View style={styles.sectionHeader}>
          <SafeIonicons name={isPersonneMorale ? "business" : "person"} size={24} color={isPersonneMorale ? theme.colors.success : theme.colors.primary} />
          <Text style={styles.sectionTitle}>
            {isPersonneMorale ? "Informations Entreprise" : "Informations Personnelles"}
          </Text>
          <Badge label="Individuel" variant="primary" icon="person" />
        </View>

        <View style={styles.divider} />

        <View style={styles.infoGrid}>
          {isPersonneMorale ? (
            <>
              <View style={styles.infoItem}>
                <View style={styles.iconCircle}>
                  <SafeIonicons name="business" size={18} color={theme.colors.success} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoLabel}>Dénomination</Text>
                  <Text style={styles.infoValue}>{displayValue(propsObj?.Denominat)}</Text>
                </View>
              </View>

              <View style={styles.infoItem}>
                <View style={styles.iconCircle}>
                  <SafeIonicons name="person-circle" size={18} color={theme.colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoLabel}>Mandataire</Text>
                  <Text style={styles.infoValue}>{displayValue(propsObj?.Mandataire)}</Text>
                </View>
              </View>
            </>
          ) : (
            <>
              <View style={styles.infoItem}>
                <View style={styles.iconCircle}>
                  <SafeIonicons name="person" size={18} color={theme.colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoLabel}>Nom complet</Text>
                  <Text style={styles.infoValue}>
                    {displayValue(propsObj?.Prenom)} {displayValue(propsObj?.Nom)}
                  </Text>
                </View>
              </View>

              <View style={styles.infoItem}>
                <View style={styles.iconCircle}>
                  <SafeIonicons name="male-female" size={18} color={theme.colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoLabel}>Sexe</Text>
                  <Text style={styles.infoValue}>{displayValue(propsObj?.Sexe)}</Text>
                </View>
              </View>

              <View style={styles.infoItem}>
                <View style={styles.iconCircle}>
                  <SafeIonicons name="heart" size={18} color={theme.colors.danger} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoLabel}>Situation matrimoniale</Text>
                  <Text style={styles.infoValue}>{displayValue(propsObj?.Situa_mat)}</Text>
                </View>
              </View>

              <View style={styles.infoItem}>
                <View style={styles.iconCircle}>
                  <SafeIonicons name="location" size={18} color={theme.colors.warning} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoLabel}>Lieu de naissance</Text>
                  <Text style={styles.infoValue}>{displayValue(propsObj?.Lieu_naiss)}</Text>
                </View>
              </View>
            </>
          )}

          <View style={styles.infoItem}>
            <View style={styles.iconCircle}>
              <SafeIonicons name="card" size={18} color={theme.colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>Numéro de pièce</Text>
              <Text style={styles.infoValue}>{displayValue(propsObj?.Num_piece)}</Text>
            </View>
          </View>

          {propsObj?.Telephone && (
            <View style={styles.infoItem}>
              <TouchableOpacity onPress={() => dialNumber(propsObj?.Telephone)} style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <View style={styles.iconCircle}>
                  <SafeIonicons name="call" size={18} color={theme.colors.success} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoLabel}>Téléphone</Text>
                  <Text style={[styles.infoValue, styles.phoneLink]}>{displayValue(propsObj?.Telephone)}</Text>
                </View>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </EnhancedCard>
    );
  };

  const renderLocationInfo = () => (
    <EnhancedCard style={{ marginBottom: theme.spacing(2) }}>
      <View style={styles.sectionHeader}>
        <SafeIonicons name="location" size={24} color={theme.colors.accent} />
        <Text style={styles.sectionTitle}>Localisation</Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.statsRow}>
        <StatsCard
          icon="map"
          title="Parcelle"
          value={displayValue(propsObj?.Num_parcel, 'N/A')}
          subtitle="Numéro"
          gradientColors={theme.colors.gradientPrimary}
          style={{ flex: 1, marginRight: theme.spacing(1) }}
        />
        <StatsCard
          icon="home"
          title="Village"
          value={displayValue(propsObj?.Village, 'N/A')}
          subtitle="Localité"
          gradientColors={theme.colors.gradientSuccess}
          style={{ flex: 1 }}
        />
      </View>

      <View style={styles.infoGrid}>
        <View style={styles.infoItem}>
          <View style={styles.iconCircle}>
            <SafeIonicons name="location-outline" size={18} color={theme.colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.infoLabel}>Région</Text>
            <Text style={styles.infoValue}>{displayValue(propsObj?.regionSenegal || propsObj?.Region)}</Text>
          </View>
        </View>

        <View style={styles.infoItem}>
          <View style={styles.iconCircle}>
            <SafeIonicons name="business-outline" size={18} color={theme.colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.infoLabel}>Département</Text>
            <Text style={styles.infoValue}>{displayValue(propsObj?.departmentSenegal || propsObj?.Department)}</Text>
          </View>
        </View>

        <View style={styles.infoItem}>
          <View style={styles.iconCircle}>
            <SafeIonicons name="flag-outline" size={18} color={theme.colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.infoLabel}>Commune</Text>
            <Text style={styles.infoValue}>{displayValue(propsObj?.communeSenegal || propsObj?.Commune)}</Text>
          </View>
        </View>

        <View style={styles.infoItem}>
          <View style={styles.iconCircle}>
            <SafeIonicons name="leaf-outline" size={18} color={theme.colors.success} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.infoLabel}>Vocation</Text>
            <Text style={styles.infoValue}>{displayValue(propsObj?.Vocation)}</Text>
          </View>
        </View>

        <View style={styles.infoItem}>
          <View style={styles.iconCircle}>
            <SafeIonicons name="apps-outline" size={18} color={theme.colors.success} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.infoLabel}>Type d'usage</Text>
            <Text style={styles.infoValue}>{displayValue(propsObj?.type_usag)}</Text>
          </View>
        </View>
      </View>
    </EnhancedCard>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={theme.colors.gradientPrimary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: Math.max(insets.top, theme.spacing(2)) }]}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <SafeIonicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Détails de la parcelle</Text>
            <Text style={styles.headerSubtitle}>
              {displayValue(propsObj?.Num_parcel, 'N/A')}
            </Text>
          </View>
          <Badge
            label={parcel?.parcel_type === 'collectif' ? 'Collectif' : 'Individuel'}
            variant={parcel?.parcel_type === 'collectif' ? 'warning' : 'primary'}
            icon={parcel?.parcel_type === 'collectif' ? 'people' : 'person'}
          />
        </View>
      </LinearGradient>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, theme.spacing(2)) }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Map Card */}
        {showMap && mainParcelRings.length > 0 && (
          <EnhancedCard style={{ marginBottom: theme.spacing(2), padding: 0, overflow: 'hidden' }}>
            <MapView
              ref={mapRef}
              style={styles.map}
              initialRegion={mapRegion}
              onMapReady={onMapReady}
              provider="google"
              mapType="hybrid"
              zoomEnabled
              pitchEnabled
              rotateEnabled
              scrollEnabled
            >
              {mainParcelRings.map((coords, idx) => (
                <Polygon 
                  key={`main-${idx}`} 
                  coordinates={coords} 
                  fillColor="rgba(33, 150, 243, 0.6)" 
                  strokeColor="#0d47a1" 
                  strokeWidth={4} 
                  zIndex={5} 
                />
              ))}
              {centroidRef.current && (
                <Marker coordinate={centroidRef.current} tracksViewChanges={false}>
                  <View style={styles.markerContainer}>
                    <Text style={styles.markerText}>{propsObj?.Num_parcel}</Text>
                  </View>
                </Marker>
              )}
            </MapView>
            <View pointerEvents="box-none" style={styles.mapOverlayContainer}>
              <View pointerEvents="auto" style={styles.mapOverlay}>
                <MapControls
                  onCenterParcel={centerOnParcel}
                  onToggleNeighbors={() => setShowNeighbors(!showNeighbors)}
                  onToggleMap={() => setShowMap(false)}
                  showNeighbors={showNeighbors}
                  showMap={showMap}
                  onNavigate={openInGoogleMaps}
                  navigateDisabled={!centroidRef.current}
                />
              </View>
            </View>
          </EnhancedCard>
        )}

        {/* Personal/Company Info */}
        {renderPersonalInfo()}

        {/* Location Info */}
        {renderLocationInfo()}

        {/* Actions */}
        <View style={styles.actions}>
          <EnhancedButton
            title="Déposer une réclamation"
            onPress={() => navigation.navigate('ComplaintForm', { parcelNumber: propsObj?.Num_parcel || parcel?.num_parcel })}
            variant="danger"
            icon="alert-circle"
            fullWidth
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingBottom: theme.spacing(2),
    paddingHorizontal: theme.spacing(2),
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(2),
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: theme.radii.full,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: theme.typography.h3,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: theme.spacing(0.5),
  },
  headerSubtitle: {
    fontSize: theme.typography.body,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing(2),
  },
  map: {
    width: '100%',
    height: 280,
  },
  mapOverlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    pointerEvents: 'box-none',
  },
  mapOverlay: {
    position: 'absolute',
    top: theme.spacing(1),
    right: theme.spacing(1),
    zIndex: 10000,
  },
  markerContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: theme.spacing(1),
    borderRadius: theme.radii.sm,
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  markerText: {
    fontSize: theme.typography.caption,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    marginBottom: theme.spacing(2),
  },
  sectionTitle: {
    fontSize: theme.typography.h4,
    fontWeight: '700',
    color: theme.colors.text,
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginBottom: theme.spacing(2),
  },
  infoGrid: {
    gap: theme.spacing(2),
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing(1.5),
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLabel: {
    fontSize: theme.typography.caption,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing(0.5),
    fontWeight: '600',
  },
  infoValue: {
    fontSize: theme.typography.body,
    color: theme.colors.text,
    fontWeight: '500',
  },
  phoneLink: {
    color: theme.colors.success,
    textDecorationLine: 'underline',
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: theme.spacing(2),
  },
  actions: {
    marginTop: theme.spacing(2),
  },
});
