import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
	View,
	Text,
	TextInput,
	StyleSheet,
	TouchableOpacity,
	Alert,
	StatusBar,
	Animated,
	Modal,
	ScrollView,
} from 'react-native';
import * as ExpoCamera from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { EdgeInsets } from 'react-native-safe-area-context';
import { SafeIonicons } from '../components/SafeIcons';
import { EnhancedCard, Badge, StatsCard, ListSkeleton } from '../ui/components';
import DatabaseManager from '../data/database';
import { useAppTheme, useThemeMode } from '../ui/ThemeProvider';
import type { Theme } from '../ui/theme';

// Camera module compatibility
const CameraModule: any = ExpoCamera as any;
const CameraView: any = (CameraModule && (CameraModule.CameraView ?? CameraModule.Camera)) ?? null;
const useCameraPermissionsHook: any = (CameraModule && (CameraModule.useCameraPermissions ?? CameraModule.useCameraPermissions)) ?? null;

interface SearchResult {
	id: number;
	num_parcel: string;
	parcel_type: 'individuel' | 'collectif';
	prenom?: string;
	nom?: string;
	prenom_m?: string;
	nom_m?: string;
	denominat?: string;
	village?: string;
	typ_pers?: string;
	geometry?: string;
	properties: string | Record<string, any>;
	// Collective-specific fields
	Prenom_M?: string;
	Nom_M?: string;
	Cas_de_Personne_001?: string;
	Quel_est_le_nombre_d_affectata?: string;
}

const PAGE_SIZE = 20;

export default function ModernSearchScreen({ navigation }: any) {
	const insets = useSafeAreaInsets();
	const theme = useAppTheme();
	const { isDark } = useThemeMode();
	const styles = useMemo(() => createStyles(theme, insets), [theme, insets]);

	const [searchQuery, setSearchQuery] = useState('');
	const [results, setResults] = useState<SearchResult[]>([]);
	const [stats, setStats] = useState({ total: 0, individual: 0, collective: 0 });
	const [loading, setLoading] = useState(false);
	const [totalResults, setTotalResults] = useState(0);
	const [page, setPage] = useState(0);
	const [loadingMore, setLoadingMore] = useState(false);
	const scrollY = useRef(new Animated.Value(0)).current;
	
	// Menu and QR scanner states
	const [menuVisible, setMenuVisible] = useState(false);
	const [showScanner, setShowScanner] = useState(false);
	const [cameraPermission, requestCameraPermission] = useCameraPermissionsHook ? useCameraPermissionsHook() : [null, () => {}];

	useEffect(() => {
		loadStats();
	}, []);

	useEffect(() => {
		const trimmed = searchQuery.trim();
		if (trimmed.length >= 2) {
			// Reset to first page on new search
			setPage(0);
			setResults([]);
			performSearch(trimmed, 0);
		} else {
			setResults([]);
			setTotalResults(0);
			setPage(0);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [searchQuery]);

	const loadStats = async () => {
		try {
			const data = await DatabaseManager.getStats?.();
			if (data) {
				setStats({
					total: data.totalParcels || 0,
					individual: data.individualParcels || 0,
					collective: data.collectiveParcels || 0,
				});
			}
		} catch (error) {
			console.error('Error loading stats:', error);
		}
	};

	const performSearch = async (query: string, pageNum: number) => {
		if (pageNum === 0) {
			setLoading(true);
		} else {
			setLoadingMore(true);
		}
		
		try {
			const rawResults = await DatabaseManager.searchParcels?.(query, {
				limit: PAGE_SIZE,
				offset: pageNum * PAGE_SIZE,
			});

			const newResults: SearchResult[] = Array.isArray(rawResults)
				? rawResults
				: Array.isArray(rawResults?.rows)
				? rawResults.rows
				: [];

			const total = rawResults?.total || 0;
			setTotalResults(total);

			if (pageNum === 0) {
				setResults(newResults);
			} else {
				setResults(prev => [...prev, ...newResults]);
			}
			
			setPage(pageNum);
		} catch (error) {
			console.error('Search error:', error);
			Alert.alert('Erreur', 'Impossible de rechercher les parcelles');
		} finally {
			setLoading(false);
			setLoadingMore(false);
		}
	};

	const loadMore = () => {
		const trimmed = searchQuery.trim();
		if (!loadingMore && !loading && trimmed.length >= 2 && results.length < totalResults) {
			performSearch(trimmed, page + 1);
		}
	};

	// Menu handlers
	const toggleMenu = () => setMenuVisible(v => !v);
	const closeMenu = () => setMenuVisible(false);

	// QR Scanner handlers
	const handleQRScanPress = async () => {
		if (!cameraPermission) {
			Alert.alert('Erreur', 'Impossible d\'accéder à la caméra');
			return;
		}
		if (!cameraPermission.granted) {
			const result = await requestCameraPermission();
			if (!result.granted) {
				Alert.alert('Permission refusée', 'L\'accès à la caméra est nécessaire pour scanner les codes QR.');
				return;
			}
		}
		setShowScanner(true);
	};

	const handleBarcodeScanned = ({ data }: { data: string }) => {
		setShowScanner(false);
		if (data) {
			setSearchQuery(data);
		}
	};

	const closeScanner = () => setShowScanner(false);

	const headerOpacity = scrollY.interpolate({
		inputRange: [0, 100],
		outputRange: [0, 1],
		extrapolate: 'clamp',
	});

	const renderParcelCard = ({ item }: { item: SearchResult }) => {
		let props: Record<string, any> = {};
		if (typeof item.properties === 'string') {
			try {
				props = JSON.parse(item.properties || '{}');
			} catch (error) {
				console.warn('Failed to parse parcel properties', error);
			}
		} else if (item.properties) {
			props = item.properties;
		}

		// Enhanced owner name resolution for both individual and collective parcels
		const getOwnerName = () => {
			if (item.parcel_type === 'individuel') {
				const prenom = item.prenom || props.Prenom || props.prenom || '';
				const nom = item.nom || props.Nom || props.nom || '';
				return `${prenom} ${nom}`.trim() || 'Non spécifié';
			} else {
				// For collective: try mandataire name first, then denominat
				const prenomM = item.prenom_m || item.Prenom_M || props.Prenom_M || props.prenom_m || '';
				const nomM = item.nom_m || item.Nom_M || props.Nom_M || props.nom_m || '';
				const mandataireName = `${prenomM} ${nomM}`.trim();
				
				if (mandataireName) {
					return mandataireName;
				}
				
				const denominat = item.denominat || props.Denominat || props.denominat || '';
				return denominat || 'Collectif';
			}
		};

		const ownerName = getOwnerName();
		
		// Get person type for individuals
		const typePers = item.typ_pers || props.Typ_pers || props.typ_pers || '';
		const personTypeLabel = typePers === 'personne_morale' ? 'Entreprise' : null;

		// Get affectataires count for collectives
		const affCount = item.parcel_type === 'collectif' 
			? (item.Quel_est_le_nombre_d_affectata || props.Quel_est_le_nombre_d_affectata || '')
			: null;

		return (
			<TouchableOpacity
				onPress={() => navigation.navigate('ParcelDetail', { 
					parcel: item, 
					properties: item.properties,
					geometry: item.geometry 
				})}
				activeOpacity={0.7}
			>
				<EnhancedCard style={styles.resultCard}>
					<View style={styles.cardContent}>
						<View style={styles.cardHeader}>
							<Text style={styles.parcelNumber}>{item.num_parcel}</Text>
							<Badge
								label={item.parcel_type === 'individuel' ? 'Individuel' : 'Collectif'}
								variant={item.parcel_type === 'individuel' ? 'primary' : 'success'}
								size="small"
							/>
						</View>

						{ownerName && ownerName !== 'Non spécifié' && (
							<View style={styles.infoRow}>
								<SafeIonicons 
									name={item.parcel_type === 'individuel' ? 'person' : 'people'} 
									size={16} 
									color={theme.colors.textSecondary} 
								/>
								<Text style={styles.infoText} numberOfLines={1}>
									{item.parcel_type === 'collectif' ? `Mandataire: ${ownerName}` : ownerName}
								</Text>
							</View>
						)}

						{personTypeLabel && (
							<View style={styles.infoRow}>
								<SafeIonicons name="business" size={16} color={theme.colors.textSecondary} />
								<Text style={styles.infoText}>{personTypeLabel}</Text>
							</View>
						)}

						{affCount && (
							<View style={styles.infoRow}>
								<SafeIonicons name="people-outline" size={16} color={theme.colors.textSecondary} />
								<Text style={styles.infoText}>{affCount} affectataires</Text>
							</View>
						)}

						{item.village && (
							<View style={styles.infoRow}>
								<SafeIonicons name="location" size={16} color={theme.colors.textSecondary} />
								<Text style={styles.infoText} numberOfLines={1}>{item.village}</Text>
							</View>
						)}
					</View>

					<View style={styles.cardFooter}>
						<TouchableOpacity
							style={styles.detailButton}
							onPress={() => navigation.navigate('ParcelDetail', { 
								parcel: item, 
								properties: item.properties,
								geometry: item.geometry 
							})}
						>
							<Text style={styles.detailButtonText}>Voir détails</Text>
							<SafeIonicons name="chevron-forward" size={16} color={theme.colors.primary} />
						</TouchableOpacity>
					</View>
				</EnhancedCard>
			</TouchableOpacity>
		);
	};

	return (
		<SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
			<StatusBar
				barStyle={isDark ? 'light-content' : 'dark-content'}
				backgroundColor="transparent"
				translucent
			/>

			<Animated.View style={[styles.headerBackground, { opacity: headerOpacity }]}>
				<LinearGradient
					colors={theme.colors.gradientPrimary}
					start={{ x: 0, y: 0 }}
					end={{ x: 1, y: 1 }}
					style={StyleSheet.absoluteFillObject}
				/>
			</Animated.View>

			<LinearGradient
				colors={theme.colors.gradientPrimary}
				start={{ x: 0, y: 0 }}
				end={{ x: 1, y: 1 }}
				style={styles.heroHeader}
			>
				<View style={styles.heroContent}>
					<Text style={styles.heroTitle}>Rechercher une parcelle</Text>
					<Text style={styles.heroSubtitle}>
						{stats.total.toLocaleString()} parcelles disponibles
					</Text>
				</View>

				<View style={styles.searchContainer}>
				<View style={styles.searchBar}>
					<SafeIonicons name="search" size={14} color={theme.colors.textTertiary} style={{ marginRight: 2 }} />
						<TextInput
							style={styles.searchInput}
							placeholder="Numéro de parcelle, nom, village..."
							placeholderTextColor={theme.colors.textTertiary}
							value={searchQuery}
							onChangeText={setSearchQuery}
						/>
					{searchQuery.length > 0 && (
						<TouchableOpacity onPress={() => setSearchQuery('')}>
							<SafeIonicons name="close-circle" size={18} color={theme.colors.textTertiary} />
							</TouchableOpacity>
						)}
					</View>
				</View>
			</LinearGradient>

			<View style={styles.resultsContainer}>
				{searchQuery.length === 0 ? (
					<ScrollView 
						showsVerticalScrollIndicator={false}
						contentContainerStyle={{ flexGrow: 1 }}
					>
					<View style={styles.emptyState}>
					<View style={styles.emptyIconContainer}>
						<SafeIonicons name="search" size={52} color={theme.colors.textTertiary} />
						</View>
						<Text style={styles.emptyTitle}>Commencez votre recherche</Text>
						<Text style={styles.emptySubtitle}>
							Entrez un numéro de parcelle, un nom ou un village
						</Text>

						<View style={styles.statsGrid}>
							<StatsCard
								title="Total"
								value={stats.total.toLocaleString()}
								icon="apps"
								variant="primary"
							/>
							<StatsCard
								title="Individuelles"
								value={stats.individual.toLocaleString()}
								icon="person"
								variant="success"
							/>
							<StatsCard
								title="Collectives"
								value={stats.collective.toLocaleString()}
								icon="people"
								variant="info"
							/>
						</View>
					</View>
					</ScrollView>
				) : loading ? (
					<ListSkeleton count={5} />
				) : results.length === 0 ? (
					<ScrollView 
						showsVerticalScrollIndicator={false}
						contentContainerStyle={{ flexGrow: 1 }}
					>
					<View style={styles.emptyState}>
					<View style={styles.emptyIconContainer}>
						<SafeIonicons name="search-outline" size={52} color={theme.colors.textTertiary} />
						</View>
						<Text style={styles.emptyTitle}>Aucun résultat</Text>
						<Text style={styles.emptySubtitle}>
							Essayez avec d'autres termes de recherche
						</Text>
					</View>
					</ScrollView>
				) : (
					<>
						<View style={styles.resultsHeader}>
							<Text style={styles.resultsCount}>
								{totalResults.toLocaleString()} résultat{totalResults > 1 ? 's' : ''}
								{totalResults > results.length && ` (${results.length} affichés)`}
							</Text>
						</View>
						<Animated.FlatList
							data={results}
							renderItem={renderParcelCard}
							keyExtractor={(item) => item.id.toString()}
							contentContainerStyle={styles.listContent}
							showsVerticalScrollIndicator={false}
							onScroll={Animated.event([
								{ nativeEvent: { contentOffset: { y: scrollY } } },
							], {
								useNativeDriver: true,
							})}
							keyboardShouldPersistTaps="handled"
							scrollEventThrottle={16}
							onEndReached={loadMore}
							onEndReachedThreshold={0.5}
							ListFooterComponent={
								loadingMore ? (
									<View style={{ padding: 16, alignItems: 'center' }}>
										<Text style={{ color: theme.colors.textSecondary }}>Chargement...</Text>
									</View>
								) : null
							}
						/>
					</>
				)}
			</View>

			{/* Floating QR Scanner Button */}
			<TouchableOpacity
				style={[styles.fab, { bottom: 16 + insets.bottom }]}
				onPress={handleQRScanPress}
				activeOpacity={0.8}
			>
				<LinearGradient
					colors={theme.colors.gradientSuccess}
					start={{ x: 0, y: 0 }}
					end={{ x: 1, y: 1 }}
					style={styles.fabGradient}
				>
					<SafeIonicons name="qr-code-outline" size={24} color="#FFFFFF" />
					<Text style={styles.fabLabel}>Scanner</Text>
				</LinearGradient>
			</TouchableOpacity>

			{/* Bottom-left Menu Button */}
			<TouchableOpacity
				style={[styles.menuButton, { bottom: 16 + insets.bottom }]}
				onPress={toggleMenu}
				activeOpacity={0.8}
			>
				<LinearGradient
					colors={theme.colors.gradientPrimary}
					start={{ x: 0, y: 0 }}
					end={{ x: 1, y: 1 }}
					style={styles.menuButtonGradient}
				>
					<SafeIonicons name="menu" size={24} color="#FFFFFF" />
				</LinearGradient>
			</TouchableOpacity>

			{/* Menu Modal */}
			{menuVisible && (
				<Modal
					visible={menuVisible}
					transparent
					animationType="fade"
					onRequestClose={closeMenu}
				>
					<TouchableOpacity 
						style={styles.menuOverlay} 
						activeOpacity={1} 
						onPress={closeMenu}
					>
						<View style={[styles.menuContainer, { backgroundColor: theme.colors.surface }]}>
							<View style={styles.menuHeader}>
								<Text style={[styles.menuHeaderText, { color: theme.colors.text }]}>Menu</Text>
								<TouchableOpacity onPress={closeMenu}>
									<SafeIonicons name="close" size={24} color={theme.colors.text} />
								</TouchableOpacity>
							</View>

							<TouchableOpacity
								style={styles.menuItem}
								onPress={() => {
									closeMenu();
									navigation.navigate('Apropos');
								}}
							>
								<SafeIonicons name="information-circle-outline" size={22} color={theme.colors.primary} />
								<View style={styles.menuItemContent}>
									<Text style={[styles.menuItemTitle, { color: theme.colors.text }]}>À propos</Text>
									<Text style={[styles.menuItemSubtitle, { color: theme.colors.textSecondary }]}>
										Informations sur l'application
									</Text>
								</View>
							</TouchableOpacity>

							<View style={[styles.menuDivider, { backgroundColor: theme.colors.borderLight }]} />

							<TouchableOpacity
								style={styles.menuItem}
								onPress={() => {
									closeMenu();
									navigation.navigate('ComplaintForm');
								}}
							>
								<SafeIonicons name="alert-circle-outline" size={22} color={theme.colors.warning} />
								<View style={styles.menuItemContent}>
									<Text style={[styles.menuItemTitle, { color: theme.colors.text }]}>Enregistrer une plainte</Text>
									<Text style={[styles.menuItemSubtitle, { color: theme.colors.textSecondary }]}>
										Soumettre un signalement
									</Text>
								</View>
							</TouchableOpacity>

							<View style={[styles.menuDivider, { backgroundColor: theme.colors.borderLight }]} />

							<TouchableOpacity
								style={styles.menuItem}
								onPress={() => {
									closeMenu();
									navigation.navigate('ComplaintEdit');
								}}
							>
								<SafeIonicons name="pencil-outline" size={22} color={theme.colors.accent} />
								<View style={styles.menuItemContent}>
									<Text style={[styles.menuItemTitle, { color: theme.colors.text }]}>Modifier une plainte</Text>
									<Text style={[styles.menuItemSubtitle, { color: theme.colors.textSecondary }]}>
										Éditer les plaintes locales
									</Text>
								</View>
							</TouchableOpacity>

							<View style={[styles.menuDivider, { backgroundColor: theme.colors.borderLight }]} />

			<TouchableOpacity
								style={styles.menuItem}
								onPress={() => {
									closeMenu();
									navigation.navigate('ComplaintExport');
								}}
							>
								<SafeIonicons name="share-social-outline" size={22} color={theme.colors.success} />
								<View style={styles.menuItemContent}>
									<Text style={[styles.menuItemTitle, { color: theme.colors.text }]}>Exporter plaintes</Text>
									<Text style={[styles.menuItemSubtitle, { color: theme.colors.textSecondary }]}>
										Exporter au format CSV
									</Text>
								</View>
							</TouchableOpacity>
						</View>
					</TouchableOpacity>
				</Modal>
			)}

			{/* QR Scanner Modal */}
			{showScanner && CameraView && (
				<Modal
					visible={showScanner}
					animationType="slide"
					onRequestClose={closeScanner}
				>
					<View style={styles.scannerContainer}>
						<CameraView
							style={StyleSheet.absoluteFillObject}
							facing="back"
							onBarcodeScanned={handleBarcodeScanned}
							barcodeScannerSettings={{
								barcodeTypes: ['qr', 'ean13', 'ean8', 'code128', 'code39'],
							}}
						/>
						<View style={styles.scannerOverlay}>
							<View style={styles.scannerHeader}>
								<TouchableOpacity onPress={closeScanner} style={styles.scannerCloseButton}>
									<SafeIonicons name="close" size={28} color="#FFFFFF" />
								</TouchableOpacity>
							</View>
							<View style={styles.scannerFrame}>
								<View style={[styles.scannerCorner, styles.scannerCornerTL]} />
								<View style={[styles.scannerCorner, styles.scannerCornerTR]} />
								<View style={[styles.scannerCorner, styles.scannerCornerBL]} />
								<View style={[styles.scannerCorner, styles.scannerCornerBR]} />
							</View>
							<Text style={styles.scannerText}>Positionnez le code QR dans le cadre</Text>
						</View>
					</View>
				</Modal>
			)}
		</SafeAreaView>
	);
}

const createStyles = (theme: Theme, insets: EdgeInsets) =>
	StyleSheet.create({
		container: {
			flex: 1,
			backgroundColor: theme.colors.background,
		},
		headerBackground: {
			position: 'absolute',
			top: 0,
			left: 0,
			right: 0,
			height: insets.top + 200,
			zIndex: 0,
		},
		heroHeader: {
			paddingTop: theme.spacing(4),
			paddingBottom: theme.spacing(4),
			paddingHorizontal: theme.spacing(2.5),
			borderBottomLeftRadius: theme.radii.xl,
			borderBottomRightRadius: theme.radii.xl,
			...theme.shadows.xl,
		},
		heroContent: {
			marginBottom: theme.spacing(3),
		},
		heroTitle: {
			fontSize: theme.typography.h1,
			fontWeight: '800',
			color: '#FFFFFF',
			marginBottom: theme.spacing(0.5),
			letterSpacing: -0.5,
			textShadowColor: 'rgba(0, 0, 0, 0.2)',
			textShadowOffset: { width: 0, height: 2 },
			textShadowRadius: 4,
		},
		heroSubtitle: {
			fontSize: theme.typography.body,
			color: 'rgba(255, 255, 255, 0.95)',
			fontWeight: '500',
			textShadowColor: 'rgba(0, 0, 0, 0.15)',
			textShadowOffset: { width: 0, height: 1 },
			textShadowRadius: 3,
		},
		searchContainer: {
			marginBottom: theme.spacing(2),
		},
		searchBar: {
			flexDirection: 'row',
			alignItems: 'center',
			backgroundColor: theme.colors.surface,
			borderRadius: theme.radii['2xl'],
			paddingHorizontal: theme.spacing(2),
			paddingVertical: theme.spacing(1.75),
			...theme.shadows.xl,
			borderWidth: 1.5,
			borderColor: 'rgba(255, 255, 255, 0.4)',
			minHeight: 52,
		},
		searchInput: {
			flex: 1,
			marginLeft: theme.spacing(1),
			marginRight: theme.spacing(1),
			paddingHorizontal: theme.spacing(0.5),
			fontSize: theme.typography.body,
			color: theme.colors.text,
			fontWeight: '500',
			lineHeight: 22,
		},
		resultsContainer: {
			flex: 1,
			paddingHorizontal: theme.spacing(2),
			paddingBottom: insets.bottom + theme.spacing(2),
		},
		resultsHeader: {
			paddingVertical: theme.spacing(2),
		},
		resultsCount: {
			fontSize: theme.typography.bodySmall,
			color: theme.colors.textSecondary,
			fontWeight: '600',
		},
		listContent: {
			paddingBottom: theme.spacing(4),
		},
		resultCard: {
			marginBottom: theme.spacing(2),
			borderRadius: theme.radii.xl,
			overflow: 'hidden',
			...theme.shadows.md,
		},
		cardContent: {
			padding: theme.spacing(2.5),
			gap: theme.spacing(0.75),
		},
		cardHeader: {
			flexDirection: 'row',
			justifyContent: 'space-between',
			alignItems: 'center',
			marginBottom: theme.spacing(1.5),
		},
		parcelNumber: {
			fontSize: theme.typography.h4,
			fontWeight: '800',
			color: theme.colors.text,
			letterSpacing: -0.3,
		},
		infoRow: {
			flexDirection: 'row',
			alignItems: 'center',
			marginTop: theme.spacing(0.25),
			gap: theme.spacing(1),
		},
		infoText: {
			fontSize: theme.typography.bodySmall,
			color: theme.colors.textSecondary,
			lineHeight: 20,
		},
		cardFooter: {
			borderTopWidth: 1,
			borderTopColor: theme.colors.borderLight,
			paddingHorizontal: theme.spacing(2),
			paddingVertical: theme.spacing(1.5),
		},
		detailButton: {
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'center',
			gap: theme.spacing(0.5),
		},
		detailButtonText: {
			fontSize: theme.typography.bodySmall,
			color: theme.colors.primary,
			fontWeight: '600',
		},
		emptyState: {
			flex: 1,
			alignItems: 'center',
			justifyContent: 'center',
			paddingHorizontal: theme.spacing(4),
			paddingTop: theme.spacing(4),
		},
		emptyIconContainer: {
			width: 110,
			height: 110,
			borderRadius: theme.radii.full,
			backgroundColor: theme.colors.backgroundDark,
			alignItems: 'center',
			justifyContent: 'center',
			marginBottom: theme.spacing(3),
			...theme.shadows.lg,
			borderWidth: 3,
			borderColor: theme.colors.border,
		},
		emptyTitle: {
			fontSize: theme.typography.h3,
			fontWeight: '800',
			color: theme.colors.text,
			marginBottom: theme.spacing(1),
			letterSpacing: -0.4,
		},
		emptySubtitle: {
			fontSize: theme.typography.body,
			color: theme.colors.textSecondary,
			textAlign: 'center',
			marginBottom: theme.spacing(4),
		},
		statsGrid: {
			width: '100%',
			marginTop: theme.spacing(2),
			gap: theme.spacing(1.5),
		},
		// Floating Action Button (FAB)
		fab: {
			position: 'absolute',
			right: 16,
			elevation: 12,
			shadowColor: '#000',
			shadowOffset: { width: 0, height: 6 },
			shadowOpacity: 0.35,
			shadowRadius: 12,
			borderRadius: theme.radii.full,
			overflow: 'hidden',
		},
		fabGradient: {
			flexDirection: 'row',
			alignItems: 'center',
			paddingHorizontal: theme.spacing(3),
			paddingVertical: theme.spacing(1.75),
			gap: theme.spacing(1),
			minHeight: 48,
		},
		fabLabel: {
			color: '#FFFFFF',
			fontSize: theme.typography.bodySmall,
			fontWeight: '600',
		},
		// Menu Button
		menuButton: {
			position: 'absolute',
			left: 16,
			width: 56,
			height: 56,
			elevation: 12,
			shadowColor: '#000',
			shadowOffset: { width: 0, height: 6 },
			shadowOpacity: 0.35,
			shadowRadius: 12,
			borderRadius: theme.radii.full,
			overflow: 'hidden',
		},
		menuButtonGradient: {
			width: '100%',
			height: '100%',
			alignItems: 'center',
			justifyContent: 'center',
		},
		menuOverlay: {
			flex: 1,
			backgroundColor: 'rgba(0, 0, 0, 0.5)',
			justifyContent: 'flex-end',
		},
		menuContainer: {
			borderTopLeftRadius: theme.radii.xl,
			borderTopRightRadius: theme.radii.xl,
			paddingBottom: insets.bottom + theme.spacing(2),
			...theme.shadows.xl,
		},
		menuHeader: {
			flexDirection: 'row',
			justifyContent: 'space-between',
			alignItems: 'center',
			paddingHorizontal: theme.spacing(3),
			paddingTop: theme.spacing(3),
			paddingBottom: theme.spacing(2),
			borderBottomWidth: 1,
			borderBottomColor: theme.colors.borderLight,
		},
		menuHeaderText: {
			fontSize: theme.typography.h3,
			fontWeight: '700',
		},
		menuItem: {
			flexDirection: 'row',
			alignItems: 'center',
			paddingHorizontal: theme.spacing(3),
			paddingVertical: theme.spacing(2),
			gap: theme.spacing(2),
		},
		menuItemContent: {
			flex: 1,
		},
		menuItemTitle: {
			fontSize: theme.typography.body,
			fontWeight: '600',
			marginBottom: theme.spacing(0.5),
		},
		menuItemSubtitle: {
			fontSize: theme.typography.caption,
		},
		menuDivider: {
			height: 1,
			marginHorizontal: theme.spacing(3),
		},
		// QR Scanner
		scannerContainer: {
			flex: 1,
			backgroundColor: '#000',
		},
		scannerOverlay: {
			...StyleSheet.absoluteFillObject,
			backgroundColor: 'rgba(0, 0, 0, 0.5)',
			justifyContent: 'space-between',
			alignItems: 'center',
			paddingVertical: 60,
		},
		scannerHeader: {
			width: '100%',
			alignItems: 'flex-end',
			paddingHorizontal: 20,
		},
		scannerCloseButton: {
			width: 44,
			height: 44,
			borderRadius: 22,
			backgroundColor: 'rgba(0, 0, 0, 0.6)',
			alignItems: 'center',
			justifyContent: 'center',
		},
		scannerFrame: {
			width: 250,
			height: 250,
			position: 'relative',
		},
		scannerCorner: {
			position: 'absolute',
			width: 40,
			height: 40,
			borderColor: '#FFFFFF',
		},
		scannerCornerTL: {
			top: 0,
			left: 0,
			borderTopWidth: 4,
			borderLeftWidth: 4,
		},
		scannerCornerTR: {
			top: 0,
			right: 0,
			borderTopWidth: 4,
			borderRightWidth: 4,
		},
		scannerCornerBL: {
			bottom: 0,
			left: 0,
			borderBottomWidth: 4,
			borderLeftWidth: 4,
		},
		scannerCornerBR: {
			bottom: 0,
			right: 0,
			borderBottomWidth: 4,
			borderRightWidth: 4,
		},
		scannerText: {
			color: '#FFFFFF',
			fontSize: theme.typography.body,
			textAlign: 'center',
			paddingHorizontal: 40,
		},
	});

