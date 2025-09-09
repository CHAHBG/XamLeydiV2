import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Platform } from 'react-native';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  SafeAreaView,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ExpoCamera from 'expo-camera';
import { SafeIonicons } from '../components/SafeIcons';
import theme from '../theme';
import { palette } from '../theme';

// Resolve camera exports at runtime to avoid mismatched TS declaration shapes across SDKs
const CameraModule: any = ExpoCamera as any;
const CameraView: any = (CameraModule && (CameraModule.CameraView ?? CameraModule.Camera)) ?? null;
const useCameraPermissionsHook: any = (CameraModule && (CameraModule.useCameraPermissions ?? CameraModule.useCameraPermissions)) ?? null;
import DatabaseManager from '../data/database';
// Legacy ParcelRow replaced progressively by CardRow in src/ui/molecules for a simpler, consistent look
import ParcelRow, { MemoizedParcelRow } from '../components/ParcelRow';
import CardRow from '../ui/molecules/CardRow';

// debug ParcelRow import
try {
  // eslint-disable-next-line no-console
  console.log('DEBUG ParcelRow type:', typeof ParcelRow, ParcelRow);
} catch (e) {
  // eslint-disable-next-line no-console
  console.error('ParcelRow debug log failed', e);
}

// Use shared SafeIonicons wrapper

// Error boundary to catch render errors and log component stack.
class ErrorBoundary extends React.Component<any, { hasError: boolean; error: any; info: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, info: any) {
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught error:', error, info && info.componentStack);
    this.setState({ error, info });
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text style={{ color: 'red', fontWeight: '700', marginBottom: 8 }}>Erreur d'affichage</Text>
          <Text>{String(this.state.error?.message ?? this.state.error)}</Text>
          <Text style={{ marginTop: 8 }}>{String(this.state.info?.componentStack ?? '')}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const staticData: SearchResult[] = [
  {
    id: 1,
    num_parcel: 'TEST-123',
    parcel_type: 'individuel',
    prenom: 'Test',
    nom: 'User',
    village: 'Test Village',
    geometry: '{}',
    properties: '{}',
  },
];

// DEBUG_MINIMAL removed; keep full UI. To test static data, set USE_STATIC_DATA in dev manually if needed.

interface SearchResult {
  id: number;
  num_parcel: string;
  parcel_type: 'individuel' | 'collectif';
  prenom?: string;
  nom?: string;
  prenom_m?: string;
  nom_m?: string;
  // Collective-specific (may exist as top-level columns or inside properties JSON)
  Prenom_M?: string;
  Nom_M?: string;
  Cas_de_Personne_001?: string;
  Quel_est_le_nombre_d_affectata?: string;
  Prenom_001?: string;
  Nom_001?: string;
  denominat?: string;
  village?: string;
  typ_pers?: string;
  geometry: string;
  properties: string | Record<string, any>;
}

const SearchScreen = ({ navigation }: any) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([] as SearchResult[]);
  const [totalResults, setTotalResults] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20; // Reduced for better performance
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  // Menu state
  const [menuVisible, setMenuVisible] = useState(false);
  
  // Use React's useRef for debounce timer for better performance
  // useRef typing as any to avoid cross-env Timeout vs number mismatch in TypeScript
  const debounceTimerRef = useRef<any>(null);
  const searchResultsCache = useRef<Record<string, {results: SearchResult[], total: number}>>({});
  
  // QR Scanner states
  const [showScanner, setShowScanner] = useState(false);
  const [scanned, setScanned] = useState(false);
  // camera permissions via resolved hook (may be undefined on some SDKs)
  const [permission, requestPermission] = useCameraPermissionsHook ? useCameraPermissionsHook() : [null, async () => ({ granted: false })];
  
  // Check database readiness on mount
  useEffect(() => {
    const checkDb = async () => {
      try {
        // Try a lightweight ping to check DB readiness (avoid loading all parcels into memory)
        let ready = false;
        try {
          const stats = await DatabaseManager.getStats?.();
          ready = !!(stats && typeof stats.totalParcels === 'number');
        } catch (e) {
          // fallback: try a COUNT select via getFirstSync if available
          try {
            // @ts-ignore
            const r = (DatabaseManager as any).db?.getFirstSync?.('SELECT COUNT(*) as count FROM parcels');
            ready = !!(r && typeof r.count === 'number');
          } catch (ee) { ready = false; }
        }
        setDbReady(ready);
        setDbError(null);
      } catch (e) {
        setDbReady(false);
        setDbError('La base de données n\'est pas prête. Veuillez réessayer plus tard.');
      }
    };
    checkDb();
  }, []);
  // permission hook handles initial permission state; no manual effect needed

  // Memoized search function to avoid repeated expensive operations
  const handleSearch = useCallback(async (query: string, nextPage = 0) => {
    if (!dbReady) {
      setSearchResults([]);
      setTotalResults(0);
      setDbError('La base de données n\'est pas prête.');
      return;
    }
    
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) {
      setSearchResults([]);
      setTotalResults(0);
      return;
    }
    
    // Check if we have cached results for this query
    const cacheKey = `${trimmedQuery}-${nextPage}`;
    if (searchResultsCache.current[trimmedQuery] && nextPage === 0) {
      // Use cached results for initial page
      setSearchResults(searchResultsCache.current[trimmedQuery].results);
      setTotalResults(searchResultsCache.current[trimmedQuery].total);
      setPage(0);
      return;
    }
    
    setLoading(true);
    setDbError(null);
    
    try {
      // Special case for searching specific parcel IDs
      // If the query is a long numeric ID like 1312010205587, use specialized search
      const isExactParcelID = /^\d{10,}$/.test(trimmedQuery);
      
      if (isExactParcelID) {
        console.log(`Detected exact parcel ID: ${trimmedQuery}, using specialized search`);
        try {
          // Try to dynamically import the specialized parcel ID search function
          const parcelIDSearch = require('../data/parcelIDSearch').default;
          if (parcelIDSearch && typeof parcelIDSearch.findParcelByExactID === 'function') {
            const result = await parcelIDSearch.findParcelByExactID(trimmedQuery);
            
            if (result) {
              console.log(`✅ Found exact parcel match for ID: ${trimmedQuery}`);
              // Create a stable result array with a single found item
              const rows = [result];
              
              // Assign a stable key to the row
              const stableRows = rows.map((r) => ({
                ...r,
                _stable_key: `parcel-${r.num_parcel || trimmedQuery}`
              }));
              
              setSearchResults(stableRows);
              setTotalResults(1);
              
              // Cache this result
              searchResultsCache.current[trimmedQuery] = { results: stableRows, total: 1 };
              setPage(nextPage);
              setLoading(false);
              return;
            } else {
              console.log(`❌ No exact match found for ID: ${trimmedQuery}, falling back to regular search`);
            }
          }
        } catch (specialSearchErr) {
          console.error(`Error using specialized search: ${specialSearchErr}`);
          console.log("Falling back to regular search");
        }
      }
      
      // Regular search flow
      const res = await DatabaseManager.searchParcels(trimmedQuery, { 
        limit: PAGE_SIZE, 
        offset: nextPage * PAGE_SIZE 
      });
      
      const rows = Array.isArray(res.rows) ? res.rows : [];

      // Assign a stable key to each row to avoid React reusing components with the wrong
      // state when items are recycled by FlatList during fast scrolling.
      const stableRows = (rows as SearchResult[]).map((r, i) => ({
        ...r,
        _stable_key: (r as any)._stable_key ?? (
          r && r.id !== undefined && r.id !== null ? `id-${r.id}` : (r && r.num_parcel ? `parcel-${r.num_parcel}` : `idx-${nextPage * PAGE_SIZE + i}`)
        ),
      }));

      if (nextPage === 0) {
        // Cache first page results for better performance
        searchResultsCache.current[trimmedQuery] = {
          results: stableRows,
          total: res.total || 0,
        };

        setSearchResults(stableRows);
      } else {
        setSearchResults((prevResults) => [...prevResults, ...stableRows]);
      }
      
      setTotalResults(res.total || 0);
      setPage(nextPage);
    } catch (error) {
      console.error('Search error:', error);
      setDbError('Erreur lors de la recherche.');
      setSearchResults([]);
      setTotalResults(0);
    } finally {
      setLoading(false);
    }
  }, [dbReady, PAGE_SIZE]);

  const handleParcelPress = (parcel: SearchResult) => {
    const safeParse = (v: any) => {
      if (v == null) return {};
      if (typeof v === 'string') { 
        try { 
          return JSON.parse(v); 
        } catch (e) { 
          return {}; 
        }
      }
      return typeof v === 'object' ? v : {};
    };
    const isEmptyObject = (obj: any) => obj === null || obj === undefined || (typeof obj === 'object' && Object.keys(obj).length === 0);
    const parsedProps = safeParse((parcel as any).properties) || {};
    // Ensure some common keys exist to avoid undefined in detail screen
    const ensure = (o: any, k: string) => { if (!(k in o)) o[k] = null; };
    ['Prenom_M','Nom_M','Cas_de_Personne_001','Quel_est_le_nombre_d_affectata','Village','regionSenegal','departmentSenegal','communeSenegal'].forEach(k => ensure(parsedProps, k));

    navigation.navigate('ParcelDetail', {
      parcel,
      geometry: safeParse((parcel as any).geometry),
      properties: parsedProps,
    });
  };

  const getDisplayName = useCallback((parcel: SearchResult) => {
    // For individual parcels
    if (parcel.parcel_type === 'individuel') {
      if (parcel.typ_pers === 'personne_morale') {
        return parcel.denominat || 'Non spécifié';
      }
      return `${parcel.prenom || ''} ${parcel.nom || ''}`.trim() || 'Non spécifié';
    }

    // For collective parcels - robust handling
    let props: Record<string, any> = {};
    if (parcel.properties) {
      if (typeof parcel.properties === 'string') {
        try {
          props = JSON.parse(parcel.properties || '{}');
        } catch (e) {
          // keep props as empty object and log in dev
          if (__DEV__) console.warn('Failed to parse parcel.properties for', parcel.num_parcel, e);
        }
      } else if (typeof parcel.properties === 'object' && parcel.properties !== null) {
        props = parcel.properties as Record<string, any>;
      }
    }

    // Determine whether this is collective via explicit flags or parcel_type
    const isCollective = parcel.parcel_type === 'collectif' || props.Cas_de_Personne_001 === 'Plusieurs_Personne_Physique';

    if (isCollective) {
      // Build a normalized map of property keys to check many legacy variants (lowercase, no-underscore, stripped diacritics)
      const normalizeKey = (k: string) => String(k || '').toLowerCase().replace(/[_\s-]/g, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const normalized: Record<string, any> = {};
      Object.keys(props || {}).forEach((k) => {
        try { normalized[normalizeKey(k)] = (props as any)[k]; } catch (e) { /* ignore */ }
      });

      const lookup = (variants: string[]) => {
        // Try exact normalized keys first
        for (const v of variants) {
          if (v in normalized && normalized[v]) return normalized[v];
        }
        // Then try startsWith to catch suffixes like _COL or other variants
        const keys = Object.keys(normalized);
        for (const v of variants) {
          const found = keys.find(k => k.startsWith(v) && normalized[k]);
          if (found) return normalized[found];
        }
        // As a last resort, try contains
        for (const v of variants) {
          const found = keys.find(k => k.includes(v) && normalized[k]);
          if (found) return normalized[found];
        }
        return null;
      };

      // Priority 1: mandataire explicit fields (many possible aliases)
      const prenomM = lookup(['prenomm', 'prenom_m', 'prenomm', 'mandataireprenom', 'prenommandataire', 'prenommandat', 'prenommand']) || parcel.Prenom_M || parcel.prenom_m || parcel.prenom;
      const nomM = lookup(['nomm', 'nom_m', 'nomm', 'mandatairenom', 'nommandataire', 'nommandat']) || parcel.Nom_M || parcel.nom_m || parcel.nom;

      const mandataireName = `${String(prenomM || '').trim()} ${String(nomM || '').trim()}`.trim();
      const affCount = lookup(['quelestlenombredaffectata', 'quelestlenombredaffectataire', 'nombreaffectataires', 'quel_est_le_nombre_d_affectata']) || (parcel as any).Quel_est_le_nombre_d_affectata || (parcel as any).quel_est_le_nombre_d_affectata;
      if (mandataireName) {
        if (affCount && !isNaN(parseInt(String(affCount)))) {
          return `${mandataireName} (${String(affCount)} affectataires)`;
        }
        return mandataireName;
      }

      // Priority 2: first affectataire fields (try zero-padded and unpadded variants)
      const firstPrenom = lookup(['prenom001', 'prenom01', 'prenom1', 'prenom_001', 'prenom_1']) || lookup(['prenom']);
      const firstNom = lookup(['nom001', 'nom01', 'nom1', 'nom_001', 'nom_1']) || lookup(['nom']);
      if (firstPrenom && firstNom) {
        return `${String(firstPrenom).trim()} ${String(firstNom).trim()}`;
      }

      // Priority 3: top-level parcel mandataire-like fields
      const topMand = `${parcel.prenom_m || parcel.Prenom_M || parcel.prenom || ''} ${parcel.nom_m || parcel.Nom_M || parcel.nom || ''}`.trim();
      if (topMand) {
        if (affCount && !isNaN(parseInt(String(affCount)))) return `${topMand} (${String(affCount)} affectataires)`;
        return topMand;
      }

      // Priority 4: village/commune display
      if (props.Village || props.communeSenegal || parcel.village) {
        return `Parcelle à ${props.Village || props.communeSenegal || parcel.village}`;
      }

      // Last resort
      return `Parcelle collective ${parcel.num_parcel}`;
    }

    // Fallback (shouldn't get here for collectif)
    return `Parcelle ${parcel.num_parcel}`;
  }, []);

  const getParcelTypeColor = (type: string) => {
    return type === 'individuel' ? '#2196F3' : '#4CAF50';
  };

  // QR Code scanning handlers
  const handleQRScanPress = () => {
    if (!permission) {
      Alert.alert('Permission', 'Demande de permission pour la caméra...');
      return;
    }
    if (!permission.granted) {
      Alert.alert(
        'Permission refusée',
        'Permission de caméra nécessaire pour scanner les QR codes',
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Accorder', onPress: requestPermission },
        ]
      );
      return;
    }
    setShowScanner(true);
    setScanned(false);
  };

  const handleBarcodeScanned = (scanningResult: any) => {
    const data = scanningResult?.data ?? scanningResult;
    setScanned(true);
    setShowScanner(false);

    // Process the scanned data
    setSearchQuery(data);
    handleSearch(data);

    Alert.alert(
      'QR Code scanné',
      `Recherche pour: ${String(data)}`,
      [{ text: 'OK', onPress: () => setScanned(false) }]
    );
  };

  const renderQRScanner = () => {
    if (!showScanner) return null;
    return (
      <Modal
        visible={showScanner}
        animationType="slide"
        onRequestClose={() => setShowScanner(false)}
      >
        <View style={styles.scannerContainer}>
          <View style={styles.scannerHeader}>
            <TouchableOpacity style={styles.closeButton} onPress={() => setShowScanner(false)}>
              <SafeIonicons name="close" size={24} color="white" />
            </TouchableOpacity>
            <Text style={styles.scannerTitle}>Scanner QR Code</Text>
            <View style={styles.placeholder} />
          </View>

              {showScanner && (
            <View style={styles.cameraContainer}>
              <CameraView
                style={StyleSheet.absoluteFillObject}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
              />

              {/* Scanner overlay */}
              <View style={styles.scannerOverlay}>
                <View style={styles.scannerFrame} />
                <Text style={styles.scannerInstructions}>
                  Positionnez le QR code dans le cadre
                </Text>
              </View>
            </View>
          )}
        </View>
      </Modal>
    );
  };

  // Use useCallback to memoize the renderSearchResult function to prevent re-creation on each render
  const renderSearchResult = useCallback(({ item }: { item: SearchResult }) => {
    try {
      if (!item || typeof item !== 'object' || !item.num_parcel) {
        console.warn('Skipping invalid search result item:', item);
        return null;
      }
      
      // Remove debug log in production to improve performance
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.log('renderSearchResult item id/type:', item.id);
      }
      
      // Use new CardRow for a compact, consistent list item appearance.
      return (
        <CardRow
          title={getDisplayName(item)}
          subtitle={item.num_parcel}
          tag={item.parcel_type}
          onPress={() => handleParcelPress(item)}
        />
      );
    } catch (e) {
      // log and return fallback UI so list can continue
      // eslint-disable-next-line no-console
      console.error('renderSearchResult error for item:', item, e);
      return (
        <View style={{ padding: 12 }}>
          <Text>Erreur d'affichage pour la parcelle {String(item?.num_parcel ?? item?.id ?? 'N/A')}</Text>
        </View>
      );
    }
  }, [handleParcelPress]); // Add dependencies

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
  <SafeIonicons name="search-outline" size={64} color="#ccc" />
      <Text style={styles.emptyStateText}>
        {searchQuery.length > 0 && !loading 
          ? 'Aucune parcelle trouvée' 
          : 'Recherchez par numéro de parcelle, nom, prénom ou scannez un QR code'
        }
      </Text>
    </View>
  );

  // Menu handlers
  // Toggle menu visibility on button press (click to open, click again to close)
  const toggleMenu = () => setMenuVisible(v => !v);
  const closeMenu = () => setMenuVisible(false);
  
  // Navigation handlers
  const navigateToApropos = () => {
    closeMenu();
    navigation.navigate('Apropos');
  };
  
  const navigateToComplaintForm = () => {
    closeMenu();
    navigation.navigate('ComplaintForm');
  };
  
  const navigateToComplaintExport = () => {
    closeMenu();
    navigation.navigate('ComplaintExport');
  };
  
  // Debounced search effect
  useEffect(() => {
    if (!dbReady) return;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    const timer = setTimeout(() => {
      handleSearch(searchQuery, 0);
    }, 400);
    debounceTimerRef.current = timer;
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, dbReady]);

  const handleLoadMore = () => {
    if (loading) return;
    const next = page + 1;
    if (searchResults.length >= totalResults) return;
    handleSearch(searchQuery, next);
  };

  // If rows are fixed height, provide getItemLayout to FlatList for performance
  const ROW_HEIGHT = 72; // adjust if styles change
  const getItemLayout = (_: any, index: number) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index });

  // DEBUG_MINIMAL removed — render full UI below

  const windowDimensions = useWindowDimensions();
  const insets = useSafeAreaInsets();
  
  return (
    <ErrorBoundary>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
        <View style={styles.searchContainer}>
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <SafeIonicons name="search-outline" size={22} color="#666" style={{ marginHorizontal: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher une parcelle..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#aaa"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <TouchableOpacity
            style={styles.qrButton}
            onPress={handleQRScanPress}
          >
            <SafeIonicons name="qr-code-outline" size={24} color="#2196F3" />
          </TouchableOpacity>
          
          {/* moved menu to floating button at bottom-left */}
        </View>
        
        {totalResults > 0 && (
          <View style={styles.resultsHeader}>
            <Text style={styles.resultsCount}>
              {totalResults} résultat{totalResults > 1 ? 's' : ''} trouvé{totalResults > 1 ? 's' : ''}
            </Text>
          </View>
        )}
      </View>

      {dbError ? (
        <View style={styles.loadingContainer}>
          <SafeIonicons name="alert-circle-outline" size={48} color="#E65100" />
          <Text style={styles.loadingText}>{dbError}</Text>
        </View>
      ) : loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Recherche en cours...</Text>
        </View>
      ) : (
        <FlatList
          data={Array.isArray(searchResults) && searchResults.length > 0 ? searchResults : []}
          renderItem={renderSearchResult}
          keyExtractor={(item: SearchResult, index: number) => {
            // Prefer an explicitly assigned stable key when available (see assignment in handleSearch)
            const base = (item as any)?._stable_key ? String((item as any)._stable_key) : (() => {
              const idPart = item?.id !== undefined && item?.id !== null ? String(item.id) : `idx-${index}`;
              const parcelPart = item?.num_parcel ? String(item.num_parcel) : item?.parcel_type || 'p';
              return `${parcelPart}-${idPart}`;
            })();
            // Append the index to ensure uniqueness across pages and avoid duplicate keys causing
            // React to reuse a component with a different hook tree.
            return `${base}-${index}`;
          }}
          style={styles.resultsList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmptyState}
          contentContainerStyle={searchResults.length === 0 ? styles.emptyContainer : undefined}
          // Virtualization tuning: prefer larger windows and batch sizes on Android to reduce mount/unmount churn
          // which can cause hook lifecycle mismatches under very fast scrolling.
          initialNumToRender={Platform.OS === 'android' ? 10 : 5}
          maxToRenderPerBatch={Platform.OS === 'android' ? 15 : 10}
          windowSize={Platform.OS === 'android' ? 21 : 5}
          updateCellsBatchingPeriod={50}
          // removeClippedSubviews can cause rendering issues on some Android devices when rapidly scrolling.
          // Keep disabled to prioritize render stability over clipping perf.
          removeClippedSubviews={false}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          getItemLayout={getItemLayout}
          ListFooterComponent={useMemo(() => (
            totalResults > 0 && searchResults.length < totalResults ? (
              <View style={{ padding: 12, alignItems: 'center' }}><Text>Chargement de {searchResults.length} / {totalResults}...</Text></View>
            ) : null
          ), [searchResults.length, totalResults])}
        />
      )}

  {/* Floating Action Button for QR Scanner */}
  <TouchableOpacity style={[styles.fab, { bottom: 16 + (insets.bottom || 0) }]} onPress={handleQRScanPress}>
  <SafeIonicons name="qr-code-outline" size={24} color="#fff" />
        <Text style={styles.fabLabel}>Scanner</Text>
      </TouchableOpacity>

      {/* Bottom-left menu button - themed and improved content */}
    <View style={[styles.menuButton, { backgroundColor: theme.colors.primary, bottom: 16 + (insets.bottom || 0) }]}> 
        <TouchableOpacity onPress={toggleMenu} style={styles.menuToggle}>
          <SafeIonicons name="menu" size={22} color={theme.colors.surface} />
        </TouchableOpacity>
          {menuVisible && (
          <View style={[styles.menuContainer, { bottom: 56 + (insets.bottom || 0) }]}>
            <TouchableOpacity style={styles.menuItem} onPress={navigateToApropos}>
              <SafeIonicons name="information-circle-outline" size={18} color={theme.colors.primary} style={styles.menuIcon} />
              <View style={{ flex: 1 }}>
                <Text style={styles.menuTitle}>À propos</Text>
                <Text style={styles.menuSubtitle}>Informations sur l'application et l'équipe</Text>
              </View>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity style={styles.menuItem} onPress={navigateToComplaintForm}>
              <SafeIonicons name="alert-circle" size={18} color={palette.danger || '#e53935'} style={styles.menuIcon} />
              <View style={{ flex: 1 }}>
                <Text style={styles.menuTitle}>Enregistrer une plainte</Text>
                <Text style={styles.menuSubtitle}>Soumettre un signalement pour cette parcelle</Text>
              </View>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity style={styles.menuItem} onPress={navigateToComplaintExport}>
              <SafeIonicons name="share-social-outline" size={18} color={theme.colors.accent} style={styles.menuIcon} />
              <View style={{ flex: 1 }}>
                <Text style={styles.menuTitle}>Exporter plainte</Text>
                <Text style={styles.menuSubtitle}>Exporter les plaintes au format CSV</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* QR Scanner Modal */}
      {renderQRScanner()}
    </View>
        </SafeAreaView>
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  fabLabel: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8,
    fontSize: 16,
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  searchContainer: {
    padding: 16,
    backgroundColor: 'white',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchBar: {
    flex: 1,
    elevation: 0,
  backgroundColor: '#ffffff',
  borderRadius: 12,
  paddingVertical: 6,
  paddingHorizontal: 8,
  borderWidth: 1,
  borderColor: '#e6e7eb',
  flexDirection: 'row',
  alignItems: 'center',
  },
  searchInput: {
  fontSize: 16,
  paddingVertical: 8,
  paddingHorizontal: 6,
  flex: 1,
  backgroundColor: 'transparent',
  },
  qrButton: {
  padding: 10,
  backgroundColor: '#ffffff00',
  borderRadius: 8,
  borderWidth: 0,
  borderColor: 'transparent',
  },
  resultsHeader: {
    marginTop: 12,
    paddingBottom: 4,
  },
  resultsCount: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  resultsList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  resultCard: {
    marginVertical: 6,
    elevation: 2,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  parcelInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    flexWrap: 'wrap',
    paddingRight: 8,
  },
  parcelNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginRight: 8,
    marginBottom: 4,
  },
  typeChip: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 2,
    marginVertical: 4,
    marginRight: 8,
    alignSelf: 'flex-start',
  },
  personTypeBadge: {
    backgroundColor: '#eee',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
    alignSelf: 'flex-start',
  },
  chipRow: {
    marginBottom: 8,
    flexDirection: 'row',
  },
  typeChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  resultDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  ownerName: {
    fontSize: 14,
    color: '#333',
    marginRight: 12,
    fontWeight: '500',
  },
  location: {
    fontSize: 12,
    color: '#666',
    marginRight: 8,
  },
  personTypeBadgeText: {
    fontSize: 11,
    color: '#333',
    fontWeight: 'bold',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyStateText: {
    marginTop: 16,
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 32,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  fab: {
  position: 'absolute',
  right: 16,
  bottom: 16,
  backgroundColor: '#2196F3',
  borderRadius: 28,
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 18,
  height: 56,
  minHeight: 56,
  paddingVertical: 0,
  elevation: 4,
  zIndex: 10,
  },
  menuButton: {
  position: 'absolute',
  left: 16,
  bottom: 16,
  backgroundColor: '#2196F3',
  borderRadius: 28,
  elevation: 6,
  height: 56,
  minHeight: 56,
  alignItems: 'center',
  justifyContent: 'center',
  paddingHorizontal: 12,
  },
  // QR Scanner styles
  scannerContainer: {
    flex: 1,
    backgroundColor: 'black',
  },
  scannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  closeButton: {
    padding: 8,
  },
  scannerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  placeholder: {
    width: 40,
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  scannerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  scannerFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: 'white',
    backgroundColor: 'transparent',
  },
  scannerInstructions: {
    color: 'white',
    fontSize: 16,
    marginTop: 20,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  // Menu styles
  menuToggle: {
  paddingHorizontal: 12,
  paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuContainer: {
  position: 'absolute',
  left: -8,
  bottom: 72,
    backgroundColor: '#fff',
    borderRadius: 10,
    elevation: 8,
    minWidth: 220,
    paddingHorizontal: 6,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  menuIcon: {
    marginRight: 12,
  },
  menuTitle: {
    fontSize: 15,
    color: '#222',
    fontWeight: '600',
  },
  menuSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#eee',
    marginHorizontal: 8,
  },
});

export default SearchScreen;