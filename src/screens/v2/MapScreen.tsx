/**
 * XamLeydi v2.0 - Map Screen (Carte)
 * Full-screen interactive map with parcel visualization and search
 */

import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  FlatList,
  Animated,
  PanResponder,
  Keyboard,
  StatusBar,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { SafeIonicons } from '../../components/SafeIcons';
import { useDesignTheme } from '../../ui/ThemeContext';
import {
  Card,
  Badge,
  SearchBar,
  Skeleton,
} from '../../ui/components/ModernComponents';
import { spacing, radii, shadows, animation } from '../../ui/designSystem';
import DatabaseManager from '../../data/database';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

// Marker tuning: keep map smooth on low-end devices
const MAX_MARKERS_ON_MAP = 120;
const MAX_LABELS_ON_MAP = 80;
const REGION_MARGIN_MULTIPLIER = 1.35;

// Bottom sheet snap points
const SNAP_POINTS = {
  CLOSED: SCREEN_HEIGHT - 100,
  PEEK: SCREEN_HEIGHT * 0.6,
  HALF: SCREEN_HEIGHT * 0.4,
  FULL: 100,
};

// Senegal center coordinates (Fatick region)
const INITIAL_REGION: Region = {
  latitude: 14.3335,
  longitude: -16.4111,
  latitudeDelta: 0.5,
  longitudeDelta: 0.5,
};

interface SearchResult {
  id: number;
  num_parcel: string;
  parcel_type: string;
  owner_name: string;
  prenom?: string;
  nom?: string;
  prenom_m?: string;
  nom_m?: string;
  denominat?: string;
  village: string;
  commune: string;
  latitude?: number;
  longitude?: number;
  surface_ha?: number;
  geometry?: any;
  properties?: any;
}

export default function MapScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useDesignTheme();
  const mapRef = useRef<MapView>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [allParcels, setAllParcels] = useState<SearchResult[]>([]);
  const [totalParcels, setTotalParcels] = useState(0);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [selectedParcel, setSelectedParcel] = useState<SearchResult | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const debounceTimer = useRef<any>(null);

  const [visibleRegion, setVisibleRegion] = useState<Region>(INITIAL_REGION);
  const [labelPositions, setLabelPositions] = useState<Record<string, { x: number; y: number }>>({});
  const labelUpdateTimer = useRef<any>(null);
  const [isMapInteracting, setIsMapInteracting] = useState(false);
  const interactionEndTimer = useRef<any>(null);

  // Bottom sheet animation
  const bottomSheetY = useRef(new Animated.Value(SNAP_POINTS.CLOSED)).current;
  const lastGestureY = useRef(SNAP_POINTS.CLOSED);

  const styles = useMemo(() => createStyles(theme, insets), [theme, insets]);

  const mapProvider = Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined;

  const isFiniteNumber = (v: unknown): v is number =>
    typeof v === 'number' && Number.isFinite(v);

  const toFiniteNumber = (v: unknown): number | undefined => {
    if (v == null) return undefined;
    const n = typeof v === 'string' ? parseFloat(v) : (v as any);
    return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
  };

  const updateLabelPositions = useCallback(async (parcels: SearchResult[]) => {
    if (!mapRef.current) return;

    const limited = parcels.slice(0, MAX_LABELS_ON_MAP);
    try {
      const entries = await Promise.all(
        limited.map(async (p) => {
          const point = await mapRef.current!.pointForCoordinate({
            latitude: p.latitude as number,
            longitude: p.longitude as number,
          });
          return [String(p.id), { x: point.x, y: point.y }] as const;
        })
      );
      setLabelPositions(Object.fromEntries(entries));
    } catch {
      // Ignore transient pointForCoordinate failures during fast pans/zooms
    }
  }, []);

  const scheduleLabelUpdate = useCallback(
    (parcels: SearchResult[], enabled: boolean) => {
      if (!enabled) {
        if (labelUpdateTimer.current) clearTimeout(labelUpdateTimer.current);
        labelUpdateTimer.current = null;
        setLabelPositions({});
        return;
      }
      if (labelUpdateTimer.current) clearTimeout(labelUpdateTimer.current);
      labelUpdateTimer.current = setTimeout(() => {
        updateLabelPositions(parcels);
      }, 80);
    },
    [updateLabelPositions]
  );

  // Load all parcels on mount
  useEffect(() => {
    loadAllParcels();
  }, []);

  const loadAllParcels = async () => {
    setInitialLoading(true);
    try {
      // Get stats first to know total
      const stats = await DatabaseManager.getStats?.();
      if (stats) {
        setTotalParcels(stats.totalParcels || 0);
      }

      // Load initial batch of parcels (show in list)
      const res = await DatabaseManager.searchParcels('', { limit: 100, offset: 0 });
      
      if (res && res.rows && Array.isArray(res.rows)) {
        const mapped = mapParcels(res.rows);
        setAllParcels(mapped);
        setSearchResults(mapped);
      } else {
        // Try getting all parcels directly
        const allRes = await DatabaseManager.getAllParcels?.();
        if (allRes && Array.isArray(allRes)) {
          const mapped = mapParcels(allRes.slice(0, 100));
          setAllParcels(mapped);
          setSearchResults(mapped);
        }
      }
    } catch (error) {
      console.error('Error loading parcels:', error);
    } finally {
      setInitialLoading(false);
      openBottomSheet();
    }
  };

  const mapParcels = (rows: any[]): SearchResult[] => {
    return rows.map((r: any) => {
      // Extract owner name from various fields
      let ownerName = '';
      if (r.prenom || r.nom) {
        ownerName = `${r.prenom || ''} ${r.nom || ''}`.trim();
      } else if (r.prenom_m || r.nom_m) {
        ownerName = `${r.prenom_m || ''} ${r.nom_m || ''}`.trim();
      } else if (r.denominat) {
        ownerName = r.denominat;
      }

      // Try to extract lat/lon from explicit columns, geometry, or properties.
      let lat: number | undefined =
        toFiniteNumber(r.latitude) ??
        toFiniteNumber(r.lat) ??
        toFiniteNumber(r.centroid_lat) ??
        toFiniteNumber(r.center_lat) ??
        toFiniteNumber(r.min_lat);
      let lon: number | undefined =
        toFiniteNumber(r.longitude) ??
        toFiniteNumber(r.lng) ??
        toFiniteNumber(r.lon) ??
        toFiniteNumber(r.centroid_lng) ??
        toFiniteNumber(r.centroid_lon) ??
        toFiniteNumber(r.center_lng) ??
        toFiniteNumber(r.center_lon) ??
        toFiniteNumber(r.min_lng);

      const computeCentroidFromRing = (ring: any[]): { lat?: number; lon?: number } => {
        if (!Array.isArray(ring) || ring.length === 0) return {};
        let sumLat = 0;
        let sumLon = 0;
        let count = 0;
        for (const c of ring) {
          if (!Array.isArray(c) || c.length < 2) continue;
          const x = toFiniteNumber(c[0]);
          const y = toFiniteNumber(c[1]);
          if (x == null || y == null) continue;
          sumLon += x;
          sumLat += y;
          count += 1;
        }
        if (count === 0) return {};
        return { lon: sumLon / count, lat: sumLat / count };
      };

      if (!isFiniteNumber(lat) || !isFiniteNumber(lon)) {
        try {
          const raw = r.geometry;
          let geom: any = typeof raw === 'string' ? JSON.parse(raw) : raw;

          // Sometimes geometry is stored as a GeoJSON Feature.
          if (geom && geom.type === 'Feature' && geom.geometry) geom = geom.geometry;

          if (geom && geom.type && geom.coordinates) {
            if (geom.type === 'Point' && Array.isArray(geom.coordinates)) {
              lon = toFiniteNumber(geom.coordinates[0]);
              lat = toFiniteNumber(geom.coordinates[1]);
            } else if (geom.type === 'Polygon' && Array.isArray(geom.coordinates) && geom.coordinates[0]) {
              const c = computeCentroidFromRing(geom.coordinates[0]);
              lon = c.lon;
              lat = c.lat;
            } else if (geom.type === 'MultiPolygon' && Array.isArray(geom.coordinates)) {
              const firstPoly = geom.coordinates[0];
              const firstRing = Array.isArray(firstPoly) ? firstPoly[0] : null;
              const c = computeCentroidFromRing(firstRing);
              lon = c.lon;
              lat = c.lat;
            }
          }
        } catch {
          // ignore geometry parse errors
        }
      }

      if (!isFiniteNumber(lat) || !isFiniteNumber(lon)) {
        try {
          const rawProps = r.properties;
          const props: any = typeof rawProps === 'string' ? JSON.parse(rawProps) : rawProps;
          if (props && typeof props === 'object') {
            lat =
              toFiniteNumber(props.latitude) ??
              toFiniteNumber(props.lat) ??
              toFiniteNumber(props.centroid_lat) ??
              toFiniteNumber(props.center_lat) ??
              lat;
            lon =
              toFiniteNumber(props.longitude) ??
              toFiniteNumber(props.lng) ??
              toFiniteNumber(props.lon) ??
              toFiniteNumber(props.centroid_lng) ??
              toFiniteNumber(props.centroid_lon) ??
              toFiniteNumber(props.center_lng) ??
              toFiniteNumber(props.center_lon) ??
              lon;
          }
        } catch {
          // ignore properties parse errors
        }
      }

      return {
        id: r.id,
        num_parcel: r.num_parcel || r.numero_parcelle || '',
        parcel_type: r.parcel_type || r.type_parcelle || 'individuel',
        owner_name: ownerName || 'Non spécifié',
        prenom: r.prenom,
        nom: r.nom,
        prenom_m: r.prenom_m,
        nom_m: r.nom_m,
        denominat: r.denominat,
        village: r.village || '',
        commune: r.commune || '',
        latitude: lat,
        longitude: lon,
        surface_ha: r.surface_ha ? parseFloat(r.surface_ha) : undefined,
        geometry: r.geometry,
        properties: r.properties,
      };
    });
  };

  // Map style for dark mode
  const mapStyle = isDark
    ? [
        { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
        { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
        { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
        { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] },
        { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#38414e' }] },
      ]
    : undefined;

  // Pan responder for bottom sheet
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 5;
      },
      onPanResponderGrant: () => {
        bottomSheetY.stopAnimation((value) => {
          lastGestureY.current = value;
        });
      },
      onPanResponderMove: (_, gestureState) => {
        const newY = lastGestureY.current + gestureState.dy;
        if (newY >= SNAP_POINTS.FULL && newY <= SNAP_POINTS.CLOSED) {
          bottomSheetY.setValue(newY);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const { dy, vy } = gestureState;
        let destSnapPoint = lastGestureY.current;

        if (Math.abs(vy) > 0.5) {
          // Fast swipe
          destSnapPoint = vy > 0 ? SNAP_POINTS.CLOSED : SNAP_POINTS.HALF;
        } else if (Math.abs(dy) > 50) {
          // Significant drag
          destSnapPoint = dy > 0 ? SNAP_POINTS.PEEK : SNAP_POINTS.HALF;
        }

        Animated.spring(bottomSheetY, {
          toValue: destSnapPoint,
          useNativeDriver: false,
          damping: 20,
          stiffness: 200,
        }).start();
        lastGestureY.current = destSnapPoint;
      },
    })
  ).current;

  const openBottomSheet = useCallback(() => {
    Animated.spring(bottomSheetY, {
      toValue: SNAP_POINTS.HALF,
      useNativeDriver: false,
      damping: 20,
      stiffness: 200,
    }).start();
    lastGestureY.current = SNAP_POINTS.HALF;
  }, [bottomSheetY]);

  const closeBottomSheet = useCallback(() => {
    Animated.spring(bottomSheetY, {
      toValue: SNAP_POINTS.CLOSED,
      useNativeDriver: false,
      damping: 20,
      stiffness: 200,
    }).start();
    lastGestureY.current = SNAP_POINTS.CLOSED;
  }, [bottomSheetY]);

  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      // Show all parcels when search is cleared
      setSearchResults(allParcels);
      setHasSearched(false);
      return;
    }

    setLoading(true);
    setHasSearched(true);

    try {
      const res = await DatabaseManager.searchParcels(query, {
        limit: 50,
        offset: 0,
      });

      if (res && res.rows && Array.isArray(res.rows)) {
        setSearchResults(mapParcels(res.rows));
      } else if (res && Array.isArray(res)) {
        setSearchResults(mapParcels(res));
      } else {
        setSearchResults([]);
      }
      openBottomSheet();
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  }, [allParcels, openBottomSheet]);

  // Debounced search on query change
  const handleSearchQueryChange = useCallback((text: string) => {
    setSearchQuery(text);
    
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (!text.trim()) {
      setSearchResults(allParcels);
      setHasSearched(false);
      return;
    }

    debounceTimer.current = setTimeout(() => {
      performSearch(text);
    }, 400);
  }, [allParcels, performSearch]);

  const handleSearch = () => {
    performSearch(searchQuery);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults(allParcels);
    setHasSearched(false);
    setSelectedParcel(null);
  };

  const handleParcelSelect = (parcel: SearchResult) => {
    setSelectedParcel(parcel);

    // If parcel has coordinates, animate to it
    if (isFiniteNumber(parcel.latitude) && isFiniteNumber(parcel.longitude) && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: parcel.latitude,
          longitude: parcel.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        animation.duration.normal
      );
    }
  };

  // After a search, auto-zoom to the result set so markers become visible.
  useEffect(() => {
    if (!hasSearched) return;
    if (!mapRef.current) return;

    const coords = searchResults
      .filter((r) => isFiniteNumber(r.latitude) && isFiniteNumber(r.longitude))
      .map((r) => ({ latitude: r.latitude as number, longitude: r.longitude as number }));

    if (coords.length === 0) return;
    if (coords.length === 1) {
      mapRef.current.animateToRegion(
        {
          latitude: coords[0].latitude,
          longitude: coords[0].longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        animation.duration.normal
      );
      return;
    }

    mapRef.current.fitToCoordinates(coords.slice(0, 50), {
      edgePadding: { top: 80, right: 60, bottom: 220, left: 60 },
      animated: true,
    });
  }, [hasSearched, searchResults]);

  const handleParcelDetail = (parcel: SearchResult) => {
    const safeParse = (v: any) => {
      if (v == null) return {};
      if (typeof v === 'string') {
        try { return JSON.parse(v); } catch { return {}; }
      }
      return typeof v === 'object' ? v : {};
    };
    const geometry = safeParse(parcel.geometry);
    const properties = safeParse(parcel.properties);
    navigation.navigate('ParcelDetail', { parcel, geometry, properties });
  };

  const renderParcelItem = ({ item }: { item: SearchResult }) => {
    const isSelected = selectedParcel?.id === item.id;

    return (
      <TouchableOpacity
        onPress={() => handleParcelDetail(item)}
        onLongPress={() => handleParcelSelect(item)}
        activeOpacity={0.7}
      >
        <Card
          style={StyleSheet.flatten([
            styles.resultCard,
            isSelected ? styles.resultCardSelected : undefined,
          ])}
          theme={theme}
        >
          <View style={styles.resultHeader}>
            <Text style={styles.resultParcelNumber}>{item.num_parcel}</Text>
            <Badge
              label={item.parcel_type === 'individuel' ? 'Individuel' : 'Collectif'}
              variant={item.parcel_type === 'individuel' ? 'primary' : 'success'}
              size="small"
              theme={theme}
            />
          </View>
          <View style={styles.resultInfo}>
            <SafeIonicons name="person" size={14} color={theme.colors.textSecondary} />
            <Text style={styles.resultText} numberOfLines={1}>
              {item.owner_name}
            </Text>
          </View>
          <View style={styles.resultInfo}>
            <SafeIonicons name="location" size={14} color={theme.colors.textSecondary} />
            <Text style={styles.resultText} numberOfLines={1}>
              {item.village}
              {item.commune ? `, ${item.commune}` : ''}
            </Text>
          </View>
          {item.surface_ha && (
            <View style={styles.resultInfo}>
              <SafeIonicons name="resize" size={14} color={theme.colors.textSecondary} />
              <Text style={styles.resultText}>{item.surface_ha.toFixed(2)} ha</Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.viewDetailBtn}
            onPress={() => handleParcelDetail(item)}
          >
            <Text style={styles.viewDetailText}>Voir détails</Text>
            <SafeIonicons name="chevron-forward" size={16} color={theme.colors.primary} />
          </TouchableOpacity>
        </Card>
      </TouchableOpacity>
    );
  };

  const renderEmptyList = () => {
    if (loading || initialLoading) {
      return (
        <View style={styles.emptyContainer}>
          <Skeleton height={100} theme={theme} style={{ marginBottom: spacing.sm }} />
          <Skeleton height={100} theme={theme} style={{ marginBottom: spacing.sm }} />
          <Skeleton height={100} theme={theme} />
        </View>
      );
    }

    if (!hasSearched && allParcels.length > 0) {
      return null; // Will show allParcels
    }

    if (!hasSearched) {
      return (
        <View style={styles.emptyContainer}>
          <SafeIonicons name="map" size={48} color={theme.colors.textTertiary} />
          <Text style={styles.emptyTitle}>Chargement des parcelles...</Text>
          <Text style={styles.emptyText}>
            Les parcelles de la base de données s'afficheront ici
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <SafeIonicons name="alert-circle" size={48} color={theme.colors.textTertiary} />
        <Text style={styles.emptyTitle}>Aucun résultat</Text>
        <Text style={styles.emptyText}>
          Aucune parcelle trouvée pour "{searchQuery}"
        </Text>
      </View>
    );
  };

  const markableResults = useMemo(() => {
    const base = searchResults.filter(
      (r) => isFiniteNumber(r.latitude) && isFiniteNumber(r.longitude)
    );

    // When user searched, search results are already limited, so render all of them
    // (no visible-region restriction). For the large browse list, keep region filtering.
    let filtered = base;
    if (!hasSearched) {
      const halfLat = (visibleRegion.latitudeDelta / 2) * REGION_MARGIN_MULTIPLIER;
      const halfLon = (visibleRegion.longitudeDelta / 2) * REGION_MARGIN_MULTIPLIER;
      const minLat = visibleRegion.latitude - halfLat;
      const maxLat = visibleRegion.latitude + halfLat;
      const minLon = visibleRegion.longitude - halfLon;
      const maxLon = visibleRegion.longitude + halfLon;

      filtered = base.filter((p) => {
        const lat = p.latitude as number;
        const lon = p.longitude as number;
        return lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon;
      });
    }

    // Keep the selected marker even if slightly outside bounds.
    if (selectedParcel?.id) {
      const sel = base.find((p) => p.id === selectedParcel.id);
      if (sel && !filtered.some((p) => p.id === sel.id)) {
        filtered = [sel, ...filtered];
      }
    }

    // Hard-cap markers (sample evenly) to keep the map responsive.
    if (filtered.length > MAX_MARKERS_ON_MAP) {
      const step = Math.ceil(filtered.length / MAX_MARKERS_ON_MAP);
      filtered = filtered.filter((_, idx) => idx % step === 0);

      // Re-ensure selected is present after sampling.
      if (selectedParcel?.id) {
        const hasSel = filtered.some((p) => p.id === selectedParcel.id);
        if (!hasSel) {
          const sel = base.find((p) => p.id === selectedParcel.id);
          if (sel) filtered = [sel, ...filtered].slice(0, MAX_MARKERS_ON_MAP);
        }
      }
    }

    return filtered;
  }, [searchResults, visibleRegion, selectedParcel?.id, hasSearched]);

  const shouldShowLabels = hasSearched || visibleRegion.latitudeDelta < 0.08;

  useEffect(() => {
    if (isMapInteracting) return;
    scheduleLabelUpdate(markableResults, shouldShowLabels);
    return () => {
      if (labelUpdateTimer.current) clearTimeout(labelUpdateTimer.current);
    };
  }, [markableResults, shouldShowLabels, scheduleLabelUpdate, isMapInteracting]);

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        translucent
        backgroundColor="transparent"
      />

      {/* Map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={mapProvider as any}
        initialRegion={INITIAL_REGION}
        showsUserLocation
        showsMyLocationButton={false}
        customMapStyle={mapStyle}
        onRegionChange={() => {
          if (!isMapInteracting) setIsMapInteracting(true);
          if (interactionEndTimer.current) clearTimeout(interactionEndTimer.current);
        }}
        onRegionChangeComplete={(r) => {
          setVisibleRegion(r);
          if (interactionEndTimer.current) clearTimeout(interactionEndTimer.current);
          interactionEndTimer.current = setTimeout(() => {
            setIsMapInteracting(false);
            scheduleLabelUpdate(markableResults, shouldShowLabels);
          }, 120);
        }}
        onPress={() => {
          Keyboard.dismiss();
          if (!searchResults.length) closeBottomSheet();
        }}
      >
        {markableResults.map((parcel) => (
          <Marker
            key={parcel.id}
            coordinate={{
              latitude: parcel.latitude!,
              longitude: parcel.longitude!,
            }}
            pinColor={selectedParcel?.id === parcel.id ? theme.colors.accent : theme.colors.primary}
            title={parcel.num_parcel}
            description={parcel.owner_name}
            onPress={() => {
              handleParcelSelect(parcel);
              handleParcelDetail(parcel);
            }}
          />
        ))}
      </MapView>

      {shouldShowLabels && !isMapInteracting && (
        <View pointerEvents="none" style={styles.labelsOverlay}>
          {markableResults.slice(0, MAX_LABELS_ON_MAP).map((parcel) => {
            const pos = labelPositions[String(parcel.id)];
            if (!pos) return null;
            return (
              <View
                key={`label-${parcel.id}`}
                style={[
                  styles.floatingLabel,
                  {
                    left: pos.x,
                    top: pos.y,
                    transform: [{ translateX: -70 }, { translateY: -64 }],
                  },
                ]}
              >
                <Text style={styles.floatingLabelTitle} numberOfLines={1}>
                  {parcel.num_parcel}
                </Text>
                <Text style={styles.floatingLabelSubtitle} numberOfLines={1}>
                  {parcel.owner_name}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Floating Search Bar */}
      <View style={[styles.searchContainer, { top: insets.top + spacing.md }]}>
        <View style={styles.searchBar}>
          <SearchBar
            value={searchQuery}
            onChangeText={handleSearchQueryChange}
            placeholder="Rechercher parcelle, nom, village..."
            onSubmit={handleSearch}
            onClear={handleClearSearch}
            theme={theme}
          />
        </View>
      </View>

      {/* My Location Button */}
      <TouchableOpacity
        style={[styles.myLocationBtn, { bottom: SCREEN_HEIGHT - SNAP_POINTS.CLOSED + spacing.lg }]}
        onPress={() => {
          // Would use user's location here
          mapRef.current?.animateToRegion(INITIAL_REGION, animation.duration.normal);
        }}
      >
        <SafeIonicons name="locate" size={22} color={theme.colors.primary} />
      </TouchableOpacity>

      {/* Bottom Sheet */}
      <Animated.View
        style={[
          styles.bottomSheet,
          {
            transform: [{ translateY: bottomSheetY }],
          },
        ]}
      >
        {/* Handle */}
        <View style={styles.handleContainer} {...panResponder.panHandlers}>
          <View style={styles.handle} />
          <Text style={styles.resultsCount}>
            {loading || initialLoading
              ? 'Chargement...'
              : hasSearched
              ? `${searchResults.length} parcelle(s) trouvée(s)`
              : `${searchResults.length} parcelles (${totalParcels} au total)`}
          </Text>
        </View>

        {/* Results List */}
        <FlatList
          data={searchResults}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderParcelItem}
          ListEmptyComponent={renderEmptyList}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      </Animated.View>
    </View>
  );
}

const createStyles = (theme: any, insets: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    map: {
      ...StyleSheet.absoluteFillObject,
    },
    searchContainer: {
      position: 'absolute',
      left: spacing.lg,
      right: spacing.lg,
      zIndex: 10,
    },
    searchBar: {
      ...shadows.medium,
      borderRadius: radii.lg,
      overflow: 'hidden',
    },
    myLocationBtn: {
      position: 'absolute',
      right: spacing.lg,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadows.medium,
    },
    bottomSheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: SCREEN_HEIGHT,
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: radii.xl,
      borderTopRightRadius: radii.xl,
      ...shadows.large,
    },
    handleContainer: {
      alignItems: 'center',
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    handle: {
      width: 40,
      height: 4,
      backgroundColor: theme.colors.borderStrong,
      borderRadius: 2,
      marginBottom: spacing.sm,
    },
    resultsCount: {
      fontSize: theme.typography.fontSize.small,
      color: theme.colors.textSecondary,
    },
    listContent: {
      padding: spacing.lg,
      paddingBottom: insets.bottom + spacing['3xl'],
    },
    resultCard: {
      marginBottom: spacing.sm,
    },
    resultCardSelected: {
      borderWidth: 2,
      borderColor: theme.colors.primary,
    },
    resultHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    resultParcelNumber: {
      fontSize: theme.typography.fontSize.h4,
      fontWeight: theme.typography.fontWeight.semiBold,
      color: theme.colors.text,
    },
    resultInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: spacing.xs,
    },
    resultText: {
      fontSize: theme.typography.fontSize.body,
      color: theme.colors.textSecondary,
      marginLeft: spacing.sm,
      flex: 1,
    },
    viewDetailBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      marginTop: spacing.md,
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    viewDetailText: {
      fontSize: theme.typography.fontSize.body,
      fontWeight: theme.typography.fontWeight.medium,
      color: theme.colors.primary,
      marginRight: spacing.xs,
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing['2xl'],
    },
    emptyTitle: {
      fontSize: theme.typography.fontSize.h4,
      fontWeight: theme.typography.fontWeight.semiBold,
      color: theme.colors.text,
      marginTop: spacing.md,
    },
    emptyText: {
      fontSize: theme.typography.fontSize.body,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginTop: spacing.sm,
      paddingHorizontal: spacing.xl,
    },
    labelsOverlay: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 2,
    },
    floatingLabel: {
      position: 'absolute',
      maxWidth: 160,
      minWidth: 100,
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderRadius: radii.md,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      ...shadows.small,
    },
    floatingLabelTitle: {
      fontSize: 11,
      fontWeight: theme.typography.fontWeight.semiBold,
      color: theme.colors.text,
    },
    floatingLabelSubtitle: {
      fontSize: 10,
      color: theme.colors.textSecondary,
      marginTop: 1,
    },
  });
