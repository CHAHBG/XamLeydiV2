/**
 * XamLeydi v2.0 - Parcel Detail Screen
 * Modern parcel information display with map and detailed sections
 */

import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Alert,
  Linking,
  Platform,
  ActivityIndicator,
  InteractionManager,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import MapView, { Polygon, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { SafeIonicons } from '../../components/SafeIcons';
import { useDesignTheme } from '../../ui/ThemeContext';
import {
  Card,
  Badge,
  SectionHeader,
  Divider,
} from '../../ui/components/ModernComponents';
import { spacing, radii, shadows } from '../../ui/designSystem';
import DatabaseManager from '../../data/database';
import normalizeProperties from '../../utils/normalizeProperties';

// Sanitize coords helper
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

// Decimate coords for performance
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

export default function ParcelDetailScreen({ route }: { route?: any }) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useDesignTheme();

  const params = route?.params || {};
  const { parcel, geometry, properties } = params;

  // State
  const [propsObj, setPropsObj] = useState<any>(() => {
    if (properties && typeof properties === 'object') return properties;
    if (properties && typeof properties === 'string') {
      try { return JSON.parse(properties); } catch { return parcel || {}; }
    }
    return parcel || {};
  });
  const [normalizedProps, setNormalizedProps] = useState<any>(null);
  const [mainParcelRings, setMainParcelRings] = useState<any[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [mapType, setMapType] = useState<'standard' | 'satellite' | 'hybrid'>('standard');
  const [showNeighbors, setShowNeighbors] = useState(false);
  const [neighborParcels, setNeighborParcels] = useState<any[]>([]);
  const [loadingNeighbors, setLoadingNeighbors] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    personal: false,
    location: false,
    affectataires: false,
    technical: false,
  });

  const mapRef = useRef<any>(null);
  const centroidRef = useRef<{ latitude: number; longitude: number } | null>(null);

  const mapProvider = Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined;

  const styles = useMemo(() => createStyles(theme, insets), [theme, insets]);

  // Normalize properties
  useEffect(() => {
    if (propsObj && Object.keys(propsObj).length > 0) {
      InteractionManager.runAfterInteractions(() => {
        const normalized = normalizeProperties(propsObj);
        if (normalized) setNormalizedProps(normalized);
      });
    }
  }, [propsObj]);

  // Parse geometry
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
        const firstRing = rings[0];
        let latSum = 0, lonSum = 0;
        firstRing.forEach((p: any) => {
          latSum += p.latitude;
          lonSum += p.longitude;
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

  // Helpers
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
  }, [mainParcelRings]);

  const centerOnParcel = () => {
    if (mapRef.current && centroidRef.current) {
      mapRef.current.animateToRegion?.({
        ...centroidRef.current,
        latitudeDelta: 0.008,
        longitudeDelta: 0.008,
      }, 600);
    }
  };

  const openInGoogleMaps = () => {
    const centroid = centroidRef.current;
    if (!centroid) {
      Alert.alert('Erreur', 'Position non disponible');
      return;
    }
    const lat = centroid.latitude;
    const lng = centroid.longitude;
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    const appleMapsUrl = `http://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`;
    const url = Platform.OS === 'ios' ? appleMapsUrl : googleMapsUrl;
    Linking.openURL(url).catch(() => Linking.openURL(googleMapsUrl).catch(() => {}));
  };

  const toggleMapType = () => {
    setMapType(prev => {
      if (prev === 'standard') return 'satellite';
      if (prev === 'satellite') return 'hybrid';
      return 'standard';
    });
  };

  const loadNeighborParcels = useCallback(async () => {
    const parcelNum = parcel?.num_parcel || propsObj?.Num_parcel;
    if (!parcelNum) return;
    
    setLoadingNeighbors(true);
    try {
      // Try getNeighborParcels first (spatial query)
      let neighbors = await DatabaseManager.getNeighborParcels?.(String(parcelNum)) || [];
      
      // Fallback: If no neighbors found, try village-based query
      if ((!Array.isArray(neighbors) || neighbors.length === 0)) {
        const village = parcel?.village || propsObj?.Village || propsObj?.village || '';
        if (village) {
          try {
            const byVillage = await DatabaseManager.getParcelsByVillage?.(village) || [];
            // Filter out current parcel
            neighbors = byVillage.filter((p: any) => 
              String(p?.num_parcel || p?.Num_parcel || p?.id) !== String(parcelNum)
            );
            // Limit to 10
            if (neighbors.length > 10) neighbors = neighbors.slice(0, 10);
          } catch (e) {
            console.warn('Village fallback failed:', e);
          }
        }
      }
      
      if (neighbors && Array.isArray(neighbors)) {
        // Filter out current parcel
        const filtered = neighbors.filter((n: any) => 
          n.num_parcel !== parcelNum && n.id !== parcel?.id
        );
        console.log('Loaded neighbors:', filtered.length);
        setNeighborParcels(filtered);
      }
    } catch (error) {
      console.error('Error loading neighbors:', error);
    } finally {
      setLoadingNeighbors(false);
    }
  }, [parcel, propsObj]);

  const toggleNeighbors = useCallback(() => {
    if (!showNeighbors && neighborParcels.length === 0) {
      loadNeighborParcels();
    }
    setShowNeighbors(!showNeighbors);
  }, [showNeighbors, neighborParcels, loadNeighborParcels]);

  const navigateToNeighbor = (neighbor: any) => {
    const params = {
      parcel: neighbor,
      geometry: neighbor.geometry,
      properties: neighbor.properties || neighbor,
    };
    // Use push so tapping neighbors works even when already on ParcelDetail
    if (typeof (navigation as any)?.push === 'function') {
      (navigation as any).push('ParcelDetail', params);
    } else {
      navigation.navigate('ParcelDetail' as never, params as never);
    }
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleFileComplaint = () => {
    const num = parcel?.num_parcel || propsObj?.Num_parcel || propsObj?.num_parcel || '';
    const village = parcel?.village || propsObj?.Village || propsObj?.village || '';
    const parcelForWizard = {
      ...(parcel || {}),
      num_parcel: num,
      village,
      properties: propsObj,
    };
    navigation.navigate('ComplaintWizard' as never, { parcel: parcelForWizard } as never);
  };

  const onMapReady = useCallback(() => {
    setMapReady(true);
    setTimeout(() => {
      if (mapRef.current && centroidRef.current) {
        mapRef.current.animateToRegion?.({
          ...centroidRef.current,
          latitudeDelta: 0.008,
          longitudeDelta: 0.008,
        }, 600);
      }
    }, 500);
  }, []);

  // Detect parcel type
  const isCollective = parcel?.parcel_type === 'collectif' || propsObj?.parcel_type === 'collectif';
  const isPersonneMorale = propsObj?.Typ_pers === 'personne_morale';

  // Render info row
  const renderInfoRow = (label: string, value: any, icon: string, isPhone = false) => (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <SafeIonicons name={icon as any} size={18} color={theme.colors.primary} />
      </View>
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        {isPhone && value && value !== 'Non disponible' ? (
          <TouchableOpacity onPress={() => dialNumber(value)}>
            <Text style={[styles.infoValue, styles.phoneLink]}>{displayValue(value)}</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.infoValue}>{displayValue(value)}</Text>
        )}
      </View>
    </View>
  );

  // Render collapsible section header
  const renderSectionHeader = (title: string, icon: string, section: keyof typeof expandedSections, badge?: { label: string; variant: 'primary' | 'warning' | 'success' }) => (
    <TouchableOpacity style={styles.sectionHeader} onPress={() => toggleSection(section)}>
      <View style={styles.sectionHeaderLeft}>
        <SafeIonicons name={icon as any} size={22} color={theme.colors.primary} />
        <Text style={styles.sectionTitle}>{title}</Text>
        {badge && <Badge label={badge.label} variant={badge.variant} theme={theme} />}
      </View>
      <SafeIonicons
        name={expandedSections[section] ? 'chevron-up' : 'chevron-down'}
        size={20}
        color={theme.colors.textSecondary}
      />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.colors.background}
      />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBack} onPress={() => navigation.goBack()}>
          <SafeIonicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Parcelle</Text>
          <Text style={styles.headerSubtitle}>{parcel?.num_parcel || propsObj?.Num_parcel || 'N/A'}</Text>
        </View>
        <TouchableOpacity style={styles.headerAction} onPress={openInGoogleMaps}>
          <SafeIonicons name="navigate" size={22} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Map Section (always visible, on top) */}
        <Card style={styles.mapCard} theme={theme}>
          <View style={styles.mapContainer}>
            <MapView
              ref={mapRef}
              style={styles.map}
              provider={mapProvider as any}
              mapType={mapType}
              initialRegion={mapRegion}
              onMapReady={onMapReady}
              showsUserLocation
              showsCompass
            >
              {/* Main Parcel Polygon */}
              {mainParcelRings.map((ring, idx) => (
                <Polygon
                  key={`main-${idx}`}
                  coordinates={ring}
                  strokeColor={theme.colors.primary}
                  fillColor={`${theme.colors.primary}40`}
                  strokeWidth={2}
                />
              ))}
              
              {/* Neighbor Parcels */}
              {showNeighbors && neighborParcels.map((neighbor, idx) => {
                try {
                  // Try multiple sources for geometry
                  const rawGeom = neighbor.__parsedGeometry || neighbor.geometry || neighbor.geometry_string || neighbor.geom;
                  if (!rawGeom) return null;
                  
                  const geom = typeof rawGeom === 'string' 
                    ? JSON.parse(rawGeom) 
                    : rawGeom;
                  if (!geom || !geom.coordinates) return null;
                  
                  let coords: Array<{ latitude: number; longitude: number }> = [];
                  
                  if (geom.type === 'Polygon' && Array.isArray(geom.coordinates[0])) {
                    coords = sanitizeCoords(geom.coordinates[0]);
                  } else if (geom.type === 'MultiPolygon' && Array.isArray(geom.coordinates?.[0]?.[0])) {
                    coords = sanitizeCoords(geom.coordinates[0][0]);
                  }
                  
                  if (coords.length === 0) return null;
                  
                  return (
                    <Polygon
                      key={`neighbor-${idx}`}
                      coordinates={coords}
                      strokeColor="#FF6B00"
                      fillColor="rgba(255, 107, 0, 0.25)"
                      strokeWidth={2}
                      tappable
                      onPress={() => navigateToNeighbor(neighbor)}
                    />
                  );
                } catch (e) {
                  console.warn('Failed to render neighbor polygon:', e);
                  return null;
                }
              })}
              
              {centroidRef.current && (
                <Marker
                  coordinate={centroidRef.current}
                  title={parcel?.num_parcel || propsObj?.Num_parcel}
                  anchor={{ x: 0.5, y: 0.5 }}
                >
                  <View style={styles.markerContainer}>
                    <SafeIonicons name="location" size={28} color={theme.colors.primary} />
                  </View>
                </Marker>
              )}
            </MapView>

            {/* Map Controls */}
            <View style={styles.mapControls}>
              <TouchableOpacity style={styles.mapControlBtn} onPress={centerOnParcel}>
                <SafeIonicons name="locate" size={20} color={theme.colors.text} />
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.mapControlBtn, mapType !== 'standard' && styles.mapControlBtnActive]} 
                onPress={toggleMapType}
              >
                <SafeIonicons 
                  name={mapType === 'standard' ? 'globe-outline' : 'globe'} 
                  size={20} 
                  color={mapType !== 'standard' ? theme.colors.primary : theme.colors.text} 
                />
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.mapControlBtn, showNeighbors && styles.mapControlBtnActive]} 
                onPress={toggleNeighbors}
              >
                {loadingNeighbors ? (
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                ) : (
                  <SafeIonicons 
                    name="layers" 
                    size={20} 
                    color={showNeighbors ? theme.colors.primary : theme.colors.text} 
                  />
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.mapControlBtn} onPress={openInGoogleMaps}>
                <SafeIonicons name="navigate" size={20} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            
            {/* Map Legend */}
            {showNeighbors && neighborParcels.length > 0 && (
              <View style={styles.mapLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: theme.colors.primary }]} />
                  <Text style={styles.legendText}>Parcelle actuelle</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: '#FF6B00' }]} />
                  <Text style={styles.legendText}>Voisines ({neighborParcels.length})</Text>
                </View>
              </View>
            )}
          </View>
        </Card>

        {/* Summary (keeps key info visible without long scrolling) */}
        <Card style={styles.sectionCard} theme={theme}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <SafeIonicons name="information-circle" size={22} color={theme.colors.primary} />
              <Text style={styles.sectionTitle}>Résumé</Text>
            </View>
          </View>
          <View style={styles.sectionContent}>
            {renderInfoRow('N° Parcelle', parcel?.num_parcel || propsObj?.Num_parcel || propsObj?.num_parcel, 'document-text')}
            {renderInfoRow('Village', propsObj?.Village || parcel?.village, 'home')}
            {renderInfoRow('Superficie', propsObj?.Superficie ? `${propsObj.Superficie} m²` : null, 'resize')}
            {renderInfoRow('Type', isCollective ? 'Collectif' : 'Individuel', 'layers')}
          </View>
        </Card>

        {/* Personal/Entity Info Section */}
        <Card style={styles.sectionCard} theme={theme}>
          {renderSectionHeader(
            isCollective ? 'Parcelle Collective' : isPersonneMorale ? 'Entreprise' : 'Propriétaire',
            isCollective ? 'people' : isPersonneMorale ? 'business' : 'person',
            'personal',
            isCollective ? { label: 'Collectif', variant: 'warning' } : { label: 'Individuel', variant: 'primary' }
          )}

          {expandedSections.personal && (
            <View style={styles.sectionContent}>
              {isCollective ? (
                <>
                  {renderInfoRow('Mandataire', `${propsObj?.Prenom_M || ''} ${propsObj?.Nom_M || ''}`.trim(), 'person')}
                  {renderInfoRow('Pièce d\'identité', propsObj?.Num_piec || propsObj?.Num_piece, 'card')}
                  {renderInfoRow('Téléphone', propsObj?.Telephon2 || propsObj?.Telephone, 'call', true)}
                  {renderInfoRow('Affectataires', normalizedProps?.affectatairesCount || '0', 'people-circle')}
                </>
              ) : isPersonneMorale ? (
                <>
                  {renderInfoRow('Dénomination', propsObj?.Denominat, 'business')}
                  {renderInfoRow('Mandataire', propsObj?.Mandataire, 'person-circle')}
                  {renderInfoRow('N° Registre', propsObj?.Num_Regist, 'document-text')}
                  {renderInfoRow('Téléphone', propsObj?.Telephone || propsObj?.Telephon2, 'call', true)}
                </>
              ) : (
                <>
                  {renderInfoRow('Nom complet', `${propsObj?.Prenom || ''} ${propsObj?.Nom || ''}`.trim(), 'person')}
                  {renderInfoRow('N° Pièce', propsObj?.Num_piece || propsObj?.Num_piec, 'card')}
                  {renderInfoRow(
                    'Date de naissance',
                    propsObj?.Date_naiss || propsObj?.date_naiss || propsObj?.Date_naissance || propsObj?.date_naissance,
                    'calendar-outline'
                  )}
                  {renderInfoRow('Résidence', propsObj?.Residence || propsObj?.residence, 'home')}
                  {renderInfoRow('Téléphone', propsObj?.Telephone || propsObj?.Telephon2, 'call', true)}
                </>
              )}
            </View>
          )}
        </Card>

        {/* Location Info Section */}
        <Card style={styles.sectionCard} theme={theme}>
          {renderSectionHeader('Localisation Administrative', 'business', 'location')}

          {expandedSections.location && (
            <View style={styles.sectionContent}>
              {renderInfoRow('Village', propsObj?.Village || parcel?.village, 'home')}
              {renderInfoRow('Commune', propsObj?.Commune || normalizedProps?.communeSenegal || propsObj?.communeSenegal, 'flag')}
              {renderInfoRow('Arrondissement', normalizedProps?.arrondissementSenegal || propsObj?.Arrondissement || propsObj?.arrondissement, 'business')}
              {renderInfoRow('Département', normalizedProps?.departmentSenegal || propsObj?.Departement || propsObj?.department || propsObj?.departement, 'business')}
              {renderInfoRow('Région', normalizedProps?.regionSenegal || propsObj?.Region || propsObj?.region, 'map')}
              {renderInfoRow('Grappe', normalizedProps?.grappeSenegal || propsObj?.Grappe || propsObj?.grappe, 'map')}
            </View>
          )}
        </Card>

        {/* Technical Info Section */}
        <Card style={styles.sectionCard} theme={theme}>
          {renderSectionHeader('Informations Techniques', 'settings', 'technical')}

          {expandedSections.technical && (
            <View style={styles.sectionContent}>
              {renderInfoRow('Statut', propsObj?.Statut || propsObj?.statut, 'checkmark-circle')}
              {renderInfoRow('Date création', propsObj?.Date_creat || propsObj?.Date_creation, 'calendar-outline')}
              {renderInfoRow('Usage', propsObj?.Usage || propsObj?.Activite, 'hammer')}
            </View>
          )}
        </Card>

        {/* Affectataires Section for Collective Parcels */}
        {isCollective && normalizedProps?.affectataires && normalizedProps.affectataires.length > 0 && (
          <Card style={styles.sectionCard} theme={theme}>
            {renderSectionHeader(
              `Affectataires (${normalizedProps.affectataires.length})`,
              'people',
              'affectataires'
            )}

            {expandedSections.affectataires && (
              <View style={styles.sectionContent}>
                {normalizedProps.affectataires.slice(0, 10).map((aff: any, idx: number) => (
                  <View key={idx} style={styles.affectataireItem}>
                    <View style={styles.affectataireAvatar}>
                      <SafeIonicons name="person" size={16} color={theme.colors.primary} />
                    </View>
                    <View style={styles.affectataireInfo}>
                      <Text style={styles.affectataireName}>
                        {aff.prenom || aff.Prenom || ''} {aff.nom || aff.Nom || ''}
                      </Text>
                      <Text style={styles.affectataireMeta}>
                        {[
                          aff.sexe || aff.Sexe,
                          aff.date_naiss || aff.Date_naiss || aff.date_naissance || aff.Date_naissance,
                          aff.numero_piece || aff.Num_piece || aff.Num_piec,
                          aff.residence || aff.Residence,
                        ]
                          .map((v: any) => (v === undefined || v === null) ? '' : String(v).trim())
                          .filter(Boolean)
                          .join(' • ') || 'Détails non disponibles'}
                      </Text>
                      {(aff.telephone || aff.Telephone) && (
                        <TouchableOpacity onPress={() => dialNumber(aff.telephone || aff.Telephone)}>
                          <Text style={styles.affectatairePhone}>{aff.telephone || aff.Telephone}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ))}
                {normalizedProps.affectataires.length > 10 && (
                  <Text style={styles.moreAffectataires}>
                    +{normalizedProps.affectataires.length - 10} autres affectataires
                  </Text>
                )}
              </View>
            )}
          </Card>
        )}

        {/* Neighbor Parcels List */}
        {showNeighbors && neighborParcels.length > 0 && (
          <View style={styles.neighborListCard}>
            <View style={[styles.sectionHeader, { marginBottom: spacing.md }]}>
              <SafeIonicons name="layers" size={22} color={theme.colors.primary} />
              <Text style={styles.sectionTitle}>
                Parcelles voisines ({neighborParcels.length})
              </Text>
            </View>
            {neighborParcels.map((neighbor, idx) => {
              const neighborName = neighbor.parcel_type === 'individuel'
                ? (neighbor.typ_pers === 'personne_morale'
                    ? neighbor.denominat || 'Non spécifié'
                    : `${neighbor.prenom || ''} ${neighbor.nom || ''}`.trim() || 'Non spécifié')
                : neighbor.denominat || `${neighbor.prenom_m || ''} ${neighbor.nom_m || ''}`.trim() || 'Non spécifié';
              
              return (
                <TouchableOpacity
                  key={neighbor.id || neighbor.num_parcel || `neighbor-${idx}`}
                  onPress={() => navigateToNeighbor(neighbor)}
                  style={[
                    styles.neighborItem,
                    idx < neighborParcels.length - 1 && styles.neighborItemBorder,
                    { backgroundColor: idx % 2 === 0 ? theme.colors.surface : theme.colors.background }
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.neighborParcelNum, { color: theme.colors.primary }]}>
                      {neighbor.num_parcel || 'N/A'}
                    </Text>
                    <Text style={[styles.neighborName, { color: theme.colors.text }]}>
                      {neighborName}
                    </Text>
                    {neighbor.village && (
                      <Text style={[styles.neighborVillage, { color: theme.colors.textSecondary }]}>
                        {neighbor.village}
                      </Text>
                    )}
                    <View style={{ alignSelf: 'flex-start', marginTop: 4 }}>
                      <Badge
                        label={neighbor.parcel_type === 'collectif' ? 'Collectif' : 'Individuel'}
                        variant={neighbor.parcel_type === 'collectif' ? 'success' : 'info'}
                        size="small"
                        theme={theme}
                      />
                    </View>
                  </View>
                  <SafeIonicons name="chevron-forward" size={24} color={theme.colors.textTertiary} />
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleFileComplaint}>
            <SafeIonicons name="document-text" size={22} color="#FFFFFF" />
            <Text style={styles.actionBtnText}>Déposer une plainte</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: any, insets: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    headerBack: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerCenter: {
      flex: 1,
      marginLeft: spacing.sm,
    },
    headerTitle: {
      fontSize: theme.typography.fontSize.small,
      color: theme.colors.textSecondary,
    },
    headerSubtitle: {
      fontSize: theme.typography.fontSize.h3,
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.text,
    },
    headerAction: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      padding: spacing.lg,
      paddingBottom: insets.bottom + spacing.xl,
    },
    // Map Styles
    mapCard: {
      marginBottom: spacing.lg,
      overflow: 'hidden',
    },
    mapContainer: {
      height: 250,
      position: 'relative',
    },
    map: {
      ...StyleSheet.absoluteFillObject,
    },
    mapToggleBtn: {
      position: 'absolute',
      top: spacing.md,
      right: spacing.md,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 20,
      ...shadows.sm,
    },
    mapCollapsed: {
      height: 64,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: radii.lg,
      marginBottom: spacing.lg,
    },
    mapCollapsedText: {
      flex: 1,
      marginLeft: spacing.sm,
      fontSize: theme.typography.fontSize.body,
      fontWeight: theme.typography.fontWeight.medium,
      color: theme.colors.text,
    },
    markerContainer: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    mapControls: {
      position: 'absolute',
      right: spacing.md,
      bottom: spacing.md,
      gap: spacing.sm,
    },
    mapControlBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadows.sm,
    },
    mapControlBtnActive: {
      backgroundColor: `${theme.colors.primary}15`,
    },
    mapLegend: {
      position: 'absolute',
      left: spacing.md,
      bottom: spacing.md,
      backgroundColor: theme.colors.surface,
      borderRadius: radii.md,
      padding: spacing.sm,
      ...shadows.sm,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: 2,
    },
    legendColor: {
      width: 12,
      height: 12,
      borderRadius: 2,
      marginRight: spacing.sm,
    },
    legendText: {
      fontSize: theme.typography.fontSize.tiny,
      color: theme.colors.textSecondary,
    },
    // Section Styles
    sectionCard: {
      marginBottom: spacing.lg,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    sectionHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    sectionTitle: {
      fontSize: theme.typography.fontSize.h4,
      fontWeight: theme.typography.fontWeight.semiBold,
      color: theme.colors.text,
    },
    sectionContent: {
      padding: spacing.md,
    },
    // Info Row Styles
    infoRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    infoIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.colors.primaryLight || `${theme.colors.primary}15`,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md,
    },
    infoContent: {
      flex: 1,
    },
    infoLabel: {
      fontSize: theme.typography.fontSize.small,
      color: theme.colors.textSecondary,
      marginBottom: 2,
    },
    infoValue: {
      fontSize: theme.typography.fontSize.body,
      fontWeight: theme.typography.fontWeight.medium,
      color: theme.colors.text,
    },
    phoneLink: {
      color: theme.colors.primary,
      textDecorationLine: 'underline',
    },
    // Neighbor List Styles
    neighborListCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: radii.lg,
      padding: spacing.lg,
      marginBottom: spacing.md,
      ...shadows.sm,
    },
    neighborItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
    },
    neighborItemBorder: {
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    neighborParcelNum: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 4,
    },
    neighborName: {
      fontSize: 14,
      marginBottom: 2,
    },
    neighborVillage: {
      fontSize: 12,
      marginBottom: 4,
    },
    // Affectataires Styles
    affectataireItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    affectataireAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.colors.primaryLight || `${theme.colors.primary}15`,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md,
    },
    affectataireInfo: {
      flex: 1,
    },
    affectataireName: {
      fontSize: theme.typography.fontSize.body,
      fontWeight: theme.typography.fontWeight.medium,
      color: theme.colors.text,
    },
    affectataireMeta: {
      fontSize: theme.typography.fontSize.small,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    affectatairePhone: {
      fontSize: theme.typography.fontSize.small,
      color: theme.colors.primary,
      marginTop: 2,
    },
    moreAffectataires: {
      fontSize: theme.typography.fontSize.small,
      color: theme.colors.textTertiary,
      textAlign: 'center',
      paddingVertical: spacing.md,
    },
    // Action Buttons
    actionsContainer: {
      marginTop: spacing.md,
    },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primary,
      borderRadius: radii.lg,
      padding: spacing.lg,
      gap: spacing.sm,
    },
    actionBtnText: {
      fontSize: theme.typography.fontSize.h4,
      fontWeight: theme.typography.fontWeight.semiBold,
      color: '#FFFFFF',
    },
  });
