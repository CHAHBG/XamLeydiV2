import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Searchbar, Card, Chip, Badge, FAB } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, Camera } from 'expo-camera';
import DatabaseManager from '../data/database';

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
  geometry: string;
  properties: string;
}

interface SearchScreenProps {
  navigation: any;
}

const SearchScreen: React.FC<SearchScreenProps> = ({ navigation }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalResults, setTotalResults] = useState(0);
  
  // QR Scanner states
  const [showScanner, setShowScanner] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);

  // Request camera permission on component mount
  useEffect(() => {
    const getCameraPermissions = async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    };

    getCameraPermissions();
  }, []);

  const handleSearch = async (query: string) => {
    if (query.trim().length < 2) {
      setSearchResults([]);
      setTotalResults(0);
      return;
    }

    setLoading(true);
    try {
      const results = await DatabaseManager.searchParcels(query.trim());
      setSearchResults(results);
      setTotalResults(results.length);
    } catch (error) {
      console.error('Search error:', error);
      Alert.alert('Erreur', 'Erreur lors de la recherche');
    } finally {
      setLoading(false);
    }
  };

  const handleParcelPress = (parcel: SearchResult) => {
    navigation.navigate('ParcelDetail', { 
      parcel,
      geometry: JSON.parse(parcel.geometry),
      properties: JSON.parse(parcel.properties)
    });
  };

  const getDisplayName = (parcel: SearchResult) => {
    if (parcel.parcel_type === 'individuel') {
      if (parcel.typ_pers === 'personne_morale') {
        return parcel.denominat || 'N/A';
      }
      return `${parcel.prenom || ''} ${parcel.nom || ''}`.trim() || 'N/A';
    } else {
      return `${parcel.prenom_m || ''} ${parcel.nom_m || ''}`.trim() || 'N/A';
    }
  };

  const getParcelTypeColor = (type: string) => {
    return type === 'individuel' ? '#2196F3' : '#4CAF50';
  };

  // QR Code scanning handlers
  const handleQRScanPress = () => {
    if (hasPermission === null) {
      Alert.alert('Permission', 'Demande de permission pour la caméra...');
      return;
    }
    if (hasPermission === false) {
      Alert.alert(
        'Permission refusée', 
        'Permission de caméra nécessaire pour scanner les QR codes',
        [
          { text: 'Annuler', style: 'cancel' },
          { 
            text: 'Paramètres', 
            onPress: () => {
              // You might want to open app settings here
              // Linking.openSettings();
            }
          }
        ]
      );
      return;
    }
    setShowScanner(true);
    setScanned(false);
  };

  const handleBarcodeScanned = ({ type, data }: { type: string; data: string }) => {
    setScanned(true);
    setShowScanner(false);
    
    // Process the scanned data
    // Assuming the QR code contains parcel number or search term
    setSearchQuery(data);
    handleSearch(data);
    
    Alert.alert(
      'QR Code scanné',
      `Recherche pour: ${data}`,
      [{ text: 'OK', onPress: () => setScanned(false) }]
    );
  };

  const renderQRScanner = () => (
    <Modal
      visible={showScanner}
      animationType="slide"
      onRequestClose={() => setShowScanner(false)}
    >
      <View style={styles.scannerContainer}>
        <View style={styles.scannerHeader}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setShowScanner(false)}
          >
            <Ionicons name="close" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.scannerTitle}>Scanner QR Code</Text>
          <View style={styles.placeholder} />
        </View>
        
        <View style={styles.cameraContainer}>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            facing="back"
            onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: ["qr"],
            }}
          />
          
          {/* Scanner overlay */}
          <View style={styles.scannerOverlay}>
            <View style={styles.scannerFrame} />
            <Text style={styles.scannerInstructions}>
              Positionnez le QR code dans le cadre
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderSearchResult = ({ item }: { item: SearchResult }) => (
    <TouchableOpacity onPress={() => handleParcelPress(item)}>
      <Card style={styles.resultCard}>
        <Card.Content>
          <View style={styles.resultHeader}>
            <View style={styles.parcelInfo}>
              <Text style={styles.parcelNumber}>{item.num_parcel}</Text>
            </View>
            <Ionicons 
              name="chevron-forward" 
              size={20} 
              color="#666"
            />
          </View>
          
          <View style={styles.chipRow}>
            <Chip 
              mode="outlined" 
              style={[styles.typeChip, { borderColor: getParcelTypeColor(item.parcel_type) }]}
              textStyle={[styles.typeChipText, { color: getParcelTypeColor(item.parcel_type) }]}
            >
              {item.parcel_type === 'individuel' ? 'Individuel' : 'Collectif'}
            </Chip>
          </View>
          
          <View style={styles.resultDetails}>
            <Text style={styles.ownerName}>{getDisplayName(item)}</Text>
            {item.village && (
              <Text style={styles.location}>
                <Ionicons name="location-outline" size={12} color="#666" />
                {' '}{item.village}
              </Text>
            )}
            {item.parcel_type === 'individuel' && item.typ_pers && (
              <Badge size={16} style={styles.personTypeBadge}>
                {item.typ_pers === 'personne_physique' ? 'PP' : 'PM'}
              </Badge>
            )}
          </View>
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="search-outline" size={64} color="#ccc" />
      <Text style={styles.emptyStateText}>
        {searchQuery.length > 0 && !loading 
          ? 'Aucune parcelle trouvée' 
          : 'Recherchez par numéro de parcelle, nom, prénom ou scannez un QR code'
        }
      </Text>
    </View>
  );

  useEffect(() => {
    handleSearch(searchQuery);
  }, [searchQuery]);

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <View style={styles.searchRow}>
          <Searchbar
            placeholder="Rechercher une parcelle..."
            onChangeText={setSearchQuery}
            value={searchQuery}
            style={styles.searchBar}
            inputStyle={styles.searchInput}
            iconColor="#666"
          />
          <TouchableOpacity
            style={styles.qrButton}
            onPress={handleQRScanPress}
          >
            <Ionicons name="qr-code-outline" size={24} color="#2196F3" />
          </TouchableOpacity>
        </View>
        
        {totalResults > 0 && (
          <View style={styles.resultsHeader}>
            <Text style={styles.resultsCount}>
              {totalResults} résultat{totalResults > 1 ? 's' : ''} trouvé{totalResults > 1 ? 's' : ''}
            </Text>
          </View>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Recherche en cours...</Text>
        </View>
      ) : (
        <FlatList
          data={searchResults}
          renderItem={renderSearchResult}
          keyExtractor={(item) => `${item.parcel_type}-${item.id}`}
          style={styles.resultsList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmptyState}
          contentContainerStyle={searchResults.length === 0 ? styles.emptyContainer : undefined}
        />
      )}

      {/* Floating Action Button for QR Scanner */}
      <FAB
        style={styles.fab}
        icon="qrcode-scan"
        onPress={handleQRScanPress}
        label="Scanner"
      />

      {/* QR Scanner Modal */}
      {renderQRScanner()}
    </View>
  );
};

const styles = StyleSheet.create({
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
    backgroundColor: '#f8f9fa',
  },
  searchInput: {
    fontSize: 16,
  },
  qrButton: {
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
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
    height: 28,
    alignSelf: 'flex-start',
  },
  chipRow: {
    marginBottom: 8,
    flexDirection: 'row',
  },
  typeChipText: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 2,
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
  personTypeBadge: {
    backgroundColor: '#e3f2fd',
    color: '#1976d2',
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
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: '#2196F3',
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
});

export default SearchScreen;