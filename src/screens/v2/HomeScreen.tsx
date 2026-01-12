/**
 * XamLeydi v2.0 - Home Screen (Accueil)
 * Modern dashboard with quick actions, recent parcels, and complaints
 */

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Alert,
  Modal,
  RefreshControl,
  FlatList,
  Keyboard,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as ExpoCamera from 'expo-camera';
import { SafeIonicons } from '../../components/SafeIcons';
import { useDesignTheme } from '../../ui/ThemeContext';
import {
  Card,
  Badge,
  SearchBar,
  QuickActionButton,
  SectionHeader,
  Divider,
  Skeleton,
} from '../../ui/components/ModernComponents';
import { spacing, radii, shadows, layout } from '../../ui/designSystem';
import DatabaseManager from '../../data/database';

// Camera module compatibility
const CameraModule: any = ExpoCamera as any;
const CameraView: any = (CameraModule && (CameraModule.CameraView ?? CameraModule.Camera)) ?? null;
const useCameraPermissionsHook: any =
  CameraModule && (CameraModule.useCameraPermissions ?? CameraModule.useCameraPermissions);

interface SearchResult {
  id: number;
  num_parcel: string;
  parcel_type: string;
  prenom?: string;
  nom?: string;
  prenom_m?: string;
  nom_m?: string;
  village?: string;
  denominat?: string;
  properties?: any;
}

interface RecentParcel {
  id: number;
  num_parcel: string;
  parcel_type: string;
  owner_name: string;
  village: string;
  viewed_at?: Date;
}

interface RecentComplaint {
  id: string;
  reference: string;
  type: string;
  status: 'pending' | 'validated' | 'rejected';
  parcel_number: string;
  created_at: Date;
}

interface Stats {
  total: number;
  individual: number;
  collective: number;
}

export default function HomeScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { theme, isDark, toggleMode } = useDesignTheme();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [displayCount, setDisplayCount] = useState(10); // Number of results to display
  const debounceTimer = useRef<any>(null);
  const [stats, setStats] = useState<Stats>({ total: 0, individual: 0, collective: 0 });
  const [recentParcels, setRecentParcels] = useState<RecentParcel[]>([]);
  const [recentComplaints, setRecentComplaints] = useState<RecentComplaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // QR scanner
  const [showScanner, setShowScanner] = useState(false);
  const [scanned, setScanned] = useState(false);

  // Camera permission
  const [cameraPermission, requestCameraPermission] = useCameraPermissionsHook
    ? useCameraPermissionsHook()
    : [null, () => {}];

  const styles = useMemo(() => createStyles(theme, insets), [theme, insets]);

  const loadData = useCallback(async () => {
    try {
      // Load stats
      const data = await DatabaseManager.getStats?.();
      if (data) {
        setStats({
          total: data.totalParcels || 0,
          individual: data.individualParcels || 0,
          collective: data.collectiveParcels || 0,
        });
      }

      // Load recent parcels from local storage or DB
      // For now, we'll use mock data - this would be connected to actual history
      setRecentParcels([]);

      // Load recent complaints
      try {
        const complaints = await DatabaseManager.getAllComplaints?.();
        if (complaints && Array.isArray(complaints)) {
          const mapped = complaints.slice(0, 5).map((c: any, idx: number) => ({
            id: c.id || String(idx),
            reference: c.reference || `DOSS-${new Date().getFullYear()}-${String(idx + 1).padStart(6, '0')}`,
            type: c.complaint_type || c.complaint_category || c.motif || 'Non spécifié',
            status: (c.status || 'pending') as 'pending' | 'validated' | 'rejected',
            parcel_number: c.parcel_number || c.parcelNumber || c.num_parcel || c.numero_parcelle || '',
            created_at: c.created_at ? new Date(c.created_at) : new Date(),
          }));
          setRecentComplaints(mapped);
        }
      } catch (e) {
        console.warn('Failed to load complaints:', e);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  // Perform real database search with debouncing
  const performSearch = useCallback(async (query: string) => {
    if (!query.trim() || query.trim().length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setSearchLoading(true);
    setShowSearchResults(true);

    try {
      const res = await DatabaseManager.searchParcels(query.trim(), {
        limit: 20,
        offset: 0,
      });

      if (res && res.rows && Array.isArray(res.rows)) {
        setSearchResults(res.rows as SearchResult[]);
      } else if (res && Array.isArray(res)) {
        setSearchResults(res as SearchResult[]);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  // Debounced search on query change
  const handleSearchQueryChange = useCallback((text: string) => {
    setSearchQuery(text);
    setDisplayCount(10); // Reset display count on new search
    
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (!text.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    debounceTimer.current = setTimeout(() => {
      performSearch(text);
    }, 400);
  }, [performSearch]);

  // Get display name for parcel
  const getDisplayName = useCallback((parcel: SearchResult) => {
    if (parcel.parcel_type === 'individuel') {
      const first = parcel.prenom || parcel.prenom_m || '';
      const last = parcel.nom || parcel.nom_m || '';
      if (first || last) return `${first} ${last}`.trim();
      if (parcel.denominat) return parcel.denominat;
    } else {
      // Collective parcel
      if (parcel.prenom_m && parcel.nom_m) {
        return `${parcel.prenom_m} ${parcel.nom_m}`.trim();
      }
      if (parcel.denominat) return parcel.denominat;
    }
    return parcel.village || `Parcelle ${parcel.num_parcel}`;
  }, []);

  // Navigate to parcel detail
  const handleParcelPress = useCallback((parcel: SearchResult) => {
    const safeParse = (v: any) => {
      if (v == null) return {};
      if (typeof v === 'string') {
        try { return JSON.parse(v); } catch { return {}; }
      }
      return typeof v === 'object' ? v : {};
    };
    const geometry = safeParse((parcel as any).geometry);
    const properties = safeParse(parcel.properties);
    navigation.navigate('ParcelDetail', { parcel, geometry, properties });
    setShowSearchResults(false);
    setSearchQuery('');
  }, [navigation]);

  const extractSearchFromScan = useCallback((raw: string) => {
    const data = String(raw ?? '').trim();
    if (!data) return '';

    // Handle URLs like https://.../?num_parcel=XXX
    try {
      if (data.startsWith('http://') || data.startsWith('https://')) {
        const u = new URL(data);
        const qp =
          u.searchParams.get('num_parcel') ||
          u.searchParams.get('numero_parcelle') ||
          u.searchParams.get('parcel') ||
          u.searchParams.get('parcelle') ||
          u.searchParams.get('q');
        if (qp) return decodeURIComponent(qp).trim();
      }
    } catch {
      // ignore
    }

    // Handle simple key/value payloads: num_parcel=XXX
    const m = data.match(/(?:num_parcel|numero_parcelle|parcel|parcelle)\s*[:=]\s*([^\s;,&]+)/i);
    if (m?.[1]) return m[1].trim();

    // Handle prefix payloads: PARCEL:XXX
    const p = data.match(/^(?:parcel|parcelle|num_parcel)\s*[:#-]\s*(.+)$/i);
    if (p?.[1]) return p[1].trim();

    // Default: use entire scanned text
    return data;
  }, []);

  const handleBarcodeScanned = useCallback(
    ({ data }: { data: string }) => {
      if (scanned) return;
      setScanned(true);
      setShowScanner(false);

      const q = extractSearchFromScan(String(data ?? ''));
      if (!q) return;

      setSearchQuery(q);
      setDisplayCount(10);
      performSearch(q);
    },
    [extractSearchFromScan, performSearch, scanned]
  );

  const handleQRScan = async () => {
    if (!CameraView) {
      Alert.alert('Scanner indisponible', "La caméra n'est pas disponible dans cette version.");
      return;
    }
    if (!cameraPermission) {
      Alert.alert('Erreur', "Impossible d'accéder à la caméra");
      return;
    }
    if (!cameraPermission.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        Alert.alert(
          'Permission refusée',
          "L'accès à la caméra est nécessaire pour scanner les codes QR."
        );
        return;
      }
    }

    Keyboard.dismiss();
    setScanned(false);
    setShowScanner(true);
  };

  const handleNewComplaint = () => {
    navigation.navigate('ComplaintWizard');
  };

  const handleAdvancedSearch = () => {
    navigation.navigate('Search');
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'validated':
        return 'success';
      default:
        return 'warning';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'validated':
        return 'Envoyé / exporté';
      default:
        return 'En attente';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'validated':
        return 'checkmark-circle' as const;
      default:
        return 'time' as const;
    }
  };

  const formatComplaintType = (type: string) => {
    return type
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.colors.background}
      />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.appName}>XamLeydi</Text>
          <Text style={styles.tagline}>Connaître la Terre</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={toggleMode} style={styles.headerIcon}>
            <SafeIonicons
              name={isDark ? 'sunny' : 'moon'}
              size={22}
              color={theme.colors.text}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => (navigation as any).navigate('Apropos')}
            style={styles.headerIcon}
          >
            <SafeIonicons
              name="information-circle-outline"
              size={22}
              color={theme.colors.text}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }
      >
        {/* Search Bar */}
        <View style={styles.searchSection}>
          <SearchBar
            value={searchQuery}
            onChangeText={handleSearchQueryChange}
            placeholder="Rechercher parcelle, nom, village..."
            onClear={() => {
              setSearchQuery('');
              setSearchResults([]);
              setShowSearchResults(false);
            }}
            theme={theme}
          />
        </View>

        {/* Search Results */}
        {showSearchResults && (
          <View style={styles.searchResultsSection}>
            {searchLoading ? (
              <View style={styles.searchLoadingContainer}>
                <Skeleton height={60} theme={theme} style={{ marginBottom: spacing.sm }} />
                <Skeleton height={60} theme={theme} style={{ marginBottom: spacing.sm }} />
                <Skeleton height={60} theme={theme} />
              </View>
            ) : searchResults.length > 0 ? (
              <>
                <Text style={styles.searchResultsCount}>
                  {searchResults.length} résultat{searchResults.length > 1 ? 's' : ''}
                </Text>
                {searchResults.slice(0, displayCount).map((parcel) => (
                  <TouchableOpacity
                    key={parcel.id}
                    onPress={() => handleParcelPress(parcel)}
                    activeOpacity={0.7}
                  >
                    <Card style={styles.searchResultCard} theme={theme}>
                      <View style={styles.searchResultHeader}>
                        <Text style={styles.searchResultName}>{getDisplayName(parcel)}</Text>
                        <Badge
                          label={parcel.parcel_type === 'individuel' ? 'Individuel' : 'Collectif'}
                          variant={parcel.parcel_type === 'individuel' ? 'primary' : 'success'}
                          size="small"
                          theme={theme}
                        />
                      </View>
                      <View style={styles.searchResultInfo}>
                        <SafeIonicons name="document-text" size={14} color={theme.colors.textSecondary} />
                        <Text style={styles.searchResultText}>{parcel.num_parcel}</Text>
                      </View>
                      {parcel.village && (
                        <View style={styles.searchResultInfo}>
                          <SafeIonicons name="location" size={14} color={theme.colors.textSecondary} />
                          <Text style={styles.searchResultText}>{parcel.village}</Text>
                        </View>
                      )}
                    </Card>
                  </TouchableOpacity>
                ))}
                {searchResults.length > displayCount && (
                  <TouchableOpacity
                    onPress={() => setDisplayCount(prev => prev + 10)}
                    style={styles.seeMoreButton}
                  >
                    <Text style={styles.seeMoreText}>Voir plus de résultats</Text>
                    <SafeIonicons name="chevron-down" size={16} color={theme.colors.primary} />
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <Card style={styles.noResultsCard} theme={theme}>
                <SafeIonicons name="search" size={32} color={theme.colors.textTertiary} />
                <Text style={styles.noResultsText}>Aucune parcelle trouvée pour "{searchQuery}"</Text>
              </Card>
            )}
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.quickActionsSection}>
          <View style={styles.quickActionsRow}>
            <QuickActionButton
              icon="qr-code"
              label="Scanner QR"
              onPress={handleQRScan}
              theme={theme}
              variant="primary"
            />
            <QuickActionButton
              icon="add-circle"
              label="Nouvelle Plainte"
              onPress={handleNewComplaint}
              theme={theme}
              variant="primary"
            />
            <QuickActionButton
              icon="map"
              label="Voir Carte"
              onPress={() => navigation.navigate('Carte')}
              theme={theme}
              variant="secondary"
            />
          </View>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsSection}>
          <View style={styles.statsRow}>
            <Card style={styles.statCard} theme={theme}>
              <SafeIonicons name="grid" size={24} color={theme.colors.primary} />
              <Text style={styles.statValue}>{stats.total.toLocaleString()}</Text>
              <Text style={styles.statLabel}>Total Parcelles</Text>
            </Card>
            <Card style={styles.statCard} theme={theme}>
              <SafeIonicons name="person" size={24} color={theme.colors.info} />
              <Text style={styles.statValue}>{stats.individual.toLocaleString()}</Text>
              <Text style={styles.statLabel}>Individuelles</Text>
            </Card>
            <Card style={styles.statCard} theme={theme}>
              <SafeIonicons name="people" size={24} color={theme.colors.success} />
              <Text style={styles.statValue}>{stats.collective.toLocaleString()}</Text>
              <Text style={styles.statLabel}>Collectives</Text>
            </Card>
          </View>
        </View>

        {/* Recent Parcels */}
        {recentParcels.length > 0 && (
          <View style={styles.section}>
            <SectionHeader
              title="Dernières consultations"
              action={{ label: 'Voir tout', onPress: () => {} }}
              theme={theme}
            />
            {recentParcels.map((parcel) => (
              <TouchableOpacity
                key={parcel.id}
                onPress={() =>
                  navigation.navigate('ParcelDetail', { parcel })
                }
                activeOpacity={0.7}
              >
                <Card style={styles.recentCard} theme={theme}>
                  <View style={styles.recentCardHeader}>
                    <Text style={styles.parcelNumber}>{parcel.num_parcel}</Text>
                    <Badge
                      label={parcel.parcel_type === 'individuel' ? 'Individuel' : 'Collectif'}
                      variant={parcel.parcel_type === 'individuel' ? 'primary' : 'success'}
                      size="small"
                      theme={theme}
                    />
                  </View>
                  <View style={styles.recentCardInfo}>
                    <SafeIonicons
                      name="person"
                      size={14}
                      color={theme.colors.textSecondary}
                    />
                    <Text style={styles.recentCardText}>{parcel.owner_name}</Text>
                  </View>
                  <View style={styles.recentCardInfo}>
                    <SafeIonicons
                      name="location"
                      size={14}
                      color={theme.colors.textSecondary}
                    />
                    <Text style={styles.recentCardText}>{parcel.village}</Text>
                  </View>
                </Card>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Recent Complaints */}
        <View style={styles.section}>
          <SectionHeader
            title="Plaintes Récentes"
            action={{
              label: 'Voir tout',
              onPress: () => navigation.navigate('Plaintes'),
            }}
            theme={theme}
          />
          {loading ? (
            <>
              <Skeleton height={80} theme={theme} style={{ marginBottom: spacing.sm }} />
              <Skeleton height={80} theme={theme} style={{ marginBottom: spacing.sm }} />
            </>
          ) : recentComplaints.length > 0 ? (
            recentComplaints.map((complaint) => (
              <TouchableOpacity
                key={complaint.id}
                onPress={() =>
                  navigation.navigate('ComplaintDetail', { complaint })
                }
                activeOpacity={0.7}
              >
                <Card style={styles.complaintCard} theme={theme}>
                  <View style={styles.complaintCardHeader}>
                    <View style={styles.complaintTitleRow}>
                      <SafeIonicons
                        name={getStatusIcon(complaint.status)}
                        size={20}
                        color={
                          complaint.status === 'validated'
                            ? theme.colors.success
                            : theme.colors.warning
                        }
                      />
                      <Text style={styles.complaintReference}>{complaint.reference}</Text>
                    </View>
                    <Badge
                      label={getStatusLabel(complaint.status)}
                      variant={getStatusBadgeVariant(complaint.status)}
                      size="small"
                      theme={theme}
                    />
                  </View>
                  <Text style={styles.complaintType}>
                    {formatComplaintType(complaint.type)}
                  </Text>
                  <View style={styles.complaintMetaRow}>
                    <View style={styles.complaintParcel}>
                      <SafeIonicons
                        name="document-text-outline"
                        size={14}
                        color={theme.colors.textTertiary}
                      />
                      <Text style={styles.complaintParcelText}>
                        Parcelle {complaint.parcel_number || 'N/A'}
                      </Text>
                    </View>
                    <View style={styles.complaintDate}>
                      <SafeIonicons
                        name="calendar-outline"
                        size={14}
                        color={theme.colors.textTertiary}
                      />
                      <Text style={styles.complaintParcelText}>{formatDate(complaint.created_at)}</Text>
                    </View>
                  </View>
                </Card>
              </TouchableOpacity>
            ))
          ) : (
            <Card style={styles.emptyCard} theme={theme}>
              <SafeIonicons
                name="document-text-outline"
                size={32}
                color={theme.colors.textTertiary}
              />
              <Text style={styles.emptyText}>Aucune plainte récente</Text>
              <TouchableOpacity
                onPress={handleNewComplaint}
                style={styles.emptyAction}
              >
                <Text style={styles.emptyActionText}>Créer une plainte</Text>
              </TouchableOpacity>
            </Card>
          )}
        </View>
      </ScrollView>

      {/* QR Scanner Modal */}
      {showScanner && (
        <Modal
          visible={showScanner}
          animationType="slide"
          onRequestClose={() => setShowScanner(false)}
        >
          <View style={styles.scannerContainer}>
            <View style={styles.scannerHeader}>
              <TouchableOpacity style={styles.scannerCloseBtn} onPress={() => setShowScanner(false)}>
                <SafeIonicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.scannerTitle}>Scanner QR Code</Text>
              <View style={styles.scannerHeaderSpacer} />
            </View>

            <View style={styles.cameraContainer}>
              {cameraPermission?.granted && CameraView ? (
                <CameraView
                  style={StyleSheet.absoluteFillObject}
                  facing="back"
                  barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                  onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
                />
              ) : (
                <View style={styles.scannerPermissionFallback}>
                  <Text style={styles.scannerPermissionText}>
                    Permission caméra requise pour scanner.
                  </Text>
                  <TouchableOpacity
                    style={styles.scannerPermissionBtn}
                    onPress={async () => {
                      const result = await requestCameraPermission();
                      if (!result?.granted) {
                        Alert.alert('Permission refusée', "Impossible d'ouvrir la caméra.");
                      }
                    }}
                  >
                    <Text style={styles.scannerPermissionBtnText}>Accorder</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View pointerEvents="none" style={styles.scannerOverlay}>
                <View style={styles.scannerFrame} />
                <Text style={styles.scannerInstructions}>Positionnez le QR code dans le cadre</Text>
              </View>
            </View>
          </View>
        </Modal>
      )}
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
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    headerLeft: {},
    appName: {
      fontSize: theme.typography.fontSize.h2,
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.primary,
    },
    tagline: {
      fontSize: theme.typography.fontSize.small,
      color: theme.colors.textSecondary,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    headerIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.colors.backgroundAlt,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: spacing.sm,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: spacing['3xl'],
    },
    // QR Scanner
    scannerContainer: {
      flex: 1,
      backgroundColor: '#000',
    },
    scannerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: insets.top + spacing.md,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
      backgroundColor: 'rgba(0,0,0,0.85)',
    },
    scannerCloseBtn: {
      padding: 8,
      width: 44,
      alignItems: 'flex-start',
    },
    scannerTitle: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: theme.typography.fontWeight.semiBold,
    },
    scannerHeaderSpacer: {
      width: 44,
    },
    cameraContainer: {
      flex: 1,
      position: 'relative',
    },
    scannerOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.25)',
    },
    scannerFrame: {
      width: 250,
      height: 250,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: '#FFFFFF',
      backgroundColor: 'transparent',
    },
    scannerInstructions: {
      color: '#FFFFFF',
      fontSize: 14,
      marginTop: 18,
      textAlign: 'center',
      paddingHorizontal: spacing.xl,
    },
    scannerPermissionFallback: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
    },
    scannerPermissionText: {
      color: '#FFFFFF',
      fontSize: 14,
      textAlign: 'center',
      marginBottom: spacing.lg,
    },
    scannerPermissionBtn: {
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      borderRadius: radii.lg,
      backgroundColor: theme.colors.primary,
    },
    scannerPermissionBtnText: {
      color: '#FFFFFF',
      fontWeight: theme.typography.fontWeight.semiBold,
    },
    searchSection: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.md,
    },
    quickActionsSection: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    quickActionsRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
    },
    statsSection: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    statCard: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: spacing.md,
      marginHorizontal: spacing.xs,
    },
    statValue: {
      fontSize: theme.typography.fontSize.h3,
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.text,
      marginTop: spacing.sm,
    },
    statLabel: {
      fontSize: theme.typography.fontSize.tiny,
      color: theme.colors.textSecondary,
      marginTop: spacing.xs,
    },
    section: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    recentCard: {
      marginBottom: spacing.sm,
    },
    recentCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    parcelNumber: {
      fontSize: theme.typography.fontSize.h4,
      fontWeight: theme.typography.fontWeight.semiBold,
      color: theme.colors.text,
    },
    recentCardInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: spacing.xs,
    },
    recentCardText: {
      fontSize: theme.typography.fontSize.body,
      color: theme.colors.textSecondary,
      marginLeft: spacing.sm,
    },
    complaintCard: {
      marginBottom: spacing.sm,
    },
    complaintCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.xs,
    },
    complaintTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      flex: 1,
      marginRight: spacing.sm,
    },
    complaintReference: {
      fontSize: theme.typography.fontSize.h4,
      fontWeight: theme.typography.fontWeight.semiBold,
      color: theme.colors.text,
    },
    complaintType: {
      fontSize: theme.typography.fontSize.body,
      color: theme.colors.textSecondary,
      marginBottom: spacing.xs,
    },
    complaintParcel: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    complaintMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    complaintDate: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    complaintParcelText: {
      fontSize: theme.typography.fontSize.small,
      color: theme.colors.textTertiary,
      marginLeft: spacing.xs,
    },
    emptyCard: {
      alignItems: 'center',
      paddingVertical: spacing.xl,
    },
    emptyText: {
      fontSize: theme.typography.fontSize.body,
      color: theme.colors.textSecondary,
      marginTop: spacing.md,
    },
    emptyAction: {
      marginTop: spacing.md,
    },
    emptyActionText: {
      fontSize: theme.typography.fontSize.body,
      fontWeight: theme.typography.fontWeight.semiBold,
      color: theme.colors.primary,
    },
    searchResultsSection: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
    },
    searchResultsCount: {
      fontSize: theme.typography.fontSize.small,
      color: theme.colors.textSecondary,
      marginBottom: spacing.sm,
    },
    searchResultCard: {
      marginBottom: spacing.sm,
    },
    searchResultHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.xs,
    },
    searchResultName: {
      fontSize: theme.typography.fontSize.body,
      fontWeight: theme.typography.fontWeight.semiBold,
      color: theme.colors.text,
      flex: 1,
      marginRight: spacing.sm,
    },
    searchResultInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: spacing.xs,
    },
    searchResultText: {
      fontSize: theme.typography.fontSize.small,
      color: theme.colors.textSecondary,
      marginLeft: spacing.xs,
    },
    searchLoadingContainer: {
      paddingVertical: spacing.md,
    },
    noResultsCard: {
      alignItems: 'center',
      paddingVertical: spacing.xl,
    },
    noResultsText: {
      fontSize: theme.typography.fontSize.body,
      color: theme.colors.textSecondary,
      marginTop: spacing.md,
      textAlign: 'center',
    },
    seeMoreButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.md,
    },
    seeMoreText: {
      fontSize: theme.typography.fontSize.body,
      color: theme.colors.primary,
      fontWeight: theme.typography.fontWeight.semiBold,
      marginRight: spacing.xs,
    },
  });
