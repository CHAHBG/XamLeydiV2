import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import MapView, { Polygon, PROVIDER_GOOGLE } from 'react-native-maps';
import { Card, Divider, Chip, Button } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';

interface ParcelDetailScreenProps {
  route: {
    params: {
      parcel: any;
      geometry: any;
      properties: any;
    };
  };
  navigation: any;
}

const { width: screenWidth } = Dimensions.get('window');

const ParcelDetailScreen: React.FC<ParcelDetailScreenProps> = ({ route, navigation }) => {
  const { parcel, geometry, properties } = route.params;
  const [showMap, setShowMap] = useState(true);

  // Debug: log geometry
  React.useEffect(() => {
    console.log('Parcel geometry:', geometry);
  }, [geometry]);

  // Convert coordinates for map display
  const getMapRegion = () => {
    if (geometry.coordinates && geometry.coordinates[0]) {
      const coords = geometry.coordinates[0];
      const lats = coords.map((coord: number[]) => coord[1]);
      const lngs = coords.map((coord: number[]) => coord[0]);
      
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      
      return {
        latitude: (minLat + maxLat) / 2,
        longitude: (minLng + maxLng) / 2,
        latitudeDelta: (maxLat - minLat) * 1.5 || 0.01,
        longitudeDelta: (maxLng - minLng) * 1.5 || 0.01,
      };
    }
    return {
      latitude: 0,
      longitude: 0,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
  };

  const getPolygonCoordinates = () => {
    // Support both Polygon and MultiPolygon
    if (!geometry || !geometry.type || !geometry.coordinates) return [];
    if (geometry.type === 'Polygon' && geometry.coordinates[0]) {
      return geometry.coordinates[0].map((coord: number[]) => ({
        latitude: coord[1],
        longitude: coord[0],
      }));
    }
    if (geometry.type === 'MultiPolygon' && geometry.coordinates[0] && geometry.coordinates[0][0]) {
      // Use the first polygon in MultiPolygon
      return geometry.coordinates[0][0].map((coord: number[]) => ({
        latitude: coord[1],
        longitude: coord[0],
      }));
    }
    return [];
  };

  const renderPersonnePhysique = () => (
    <Card style={styles.card}>
      <Card.Content>
        <View style={styles.cardHeader}>
          <Ionicons name="person" size={24} color="#2196F3" />
          <Text style={styles.cardTitle}>Informations Personnelles</Text>
        </View>
        <Divider style={styles.divider} />
        
        <View style={styles.infoRow}>
          <Text style={styles.label}>Prénom:</Text>
          <Text style={styles.value}>{properties.Prenom || 'N/A'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Nom:</Text>
          <Text style={styles.value}>{properties.Nom || 'N/A'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Sexe:</Text>
          <Text style={styles.value}>{properties.Sexe || 'N/A'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Situation matrimoniale:</Text>
          <Text style={styles.value}>{properties.Situa_mat || 'N/A'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Date de naissance:</Text>
          <Text style={styles.value}>
            {properties.Date_naiss ? new Date(properties.Date_naiss).toLocaleDateString('fr-FR') : 'N/A'}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Lieu de naissance:</Text>
          <Text style={styles.value}>{properties.Lieu_naiss || 'N/A'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Type de pièce:</Text>
          <Text style={styles.value}>{properties.Type_piece || 'N/A'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Numéro de pièce:</Text>
          <Text style={styles.value}>{properties.Num_piece || 'N/A'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Téléphone:</Text>
          <Text style={styles.value}>{properties.Telephone || 'N/A'}</Text>
        </View>
      </Card.Content>
    </Card>
  );

  const renderPersonneMorale = () => (
    <Card style={styles.card}>
      <Card.Content>
        <View style={styles.cardHeader}>
          <Ionicons name="business" size={24} color="#4CAF50" />
          <Text style={styles.cardTitle}>Informations Entreprise</Text>
        </View>
        <Divider style={styles.divider} />
        
        <View style={styles.infoRow}>
          <Text style={styles.label}>Dénomination:</Text>
          <Text style={styles.value}>{properties.Denominat || 'N/A'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Mandataire:</Text>
          <Text style={styles.value}>{properties.Mandataire || 'N/A'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Téléphone:</Text>
          <Text style={styles.value}>{properties.Telephone_001 || 'N/A'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Numéro de pièce:</Text>
          <Text style={styles.value}>{properties.Num_piece || 'N/A'}</Text>
        </View>
      </Card.Content>
    </Card>
  );

  const renderParcelCollectif = () => (
    <Card style={styles.card}>
      <Card.Content>
        <View style={styles.cardHeader}>
          <Ionicons name="people" size={24} color="#FF9800" />
          <Text style={styles.cardTitle}>Parcelle Collective</Text>
        </View>
        <Divider style={styles.divider} />
        
        <View style={styles.infoRow}>
          <Text style={styles.label}>Prénom (Mandataire):</Text>
          <Text style={styles.value}>{properties.Prenom_M || 'N/A'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Nom (Mandataire):</Text>
          <Text style={styles.value}>{properties.Nom_M || 'N/A'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Âge:</Text>
          <Text style={styles.value}>{properties.Age || 'N/A'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Sexe:</Text>
          <Text style={styles.value}>{properties.Sexe_Mndt || 'N/A'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Nombre d'affectataires:</Text>
          <Text style={styles.value}>{properties.Quel_est_le_nombre_d_affectata || 'N/A'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Numéro de pièce:</Text>
          <Text style={styles.value}>{properties.Num_piec || 'N/A'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Téléphone:</Text>
          <Text style={styles.value}>{properties.Telephon2 || 'N/A'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Lieu de résidence:</Text>
          <Text style={styles.value}>{properties.Lieu_resi2 || 'N/A'}</Text>
        </View>
      </Card.Content>
    </Card>
  );

  const renderParcelInfo = () => (
    <Card style={styles.card}>
      <Card.Content>
        <View style={styles.cardHeader}>
          <Ionicons name="map" size={24} color="#9C27B0" />
          <Text style={styles.cardTitle}>Informations Parcelle</Text>
        </View>
        <Divider style={styles.divider} />
        
        <View style={styles.infoRow}>
          <Text style={styles.label}>Numéro de parcelle:</Text>
          <Text style={styles.valueImportant}>{properties.Num_parcel}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Village:</Text>
          <Text style={styles.value}>{properties.Village || properties.village || 'N/A'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Région:</Text>
          <Text style={styles.value}>{properties.regionSenegal || 'N/A'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Département:</Text>
          <Text style={styles.value}>{properties.departmentSenegal || 'N/A'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Commune:</Text>
          <Text style={styles.value}>{properties.communeSenegal || 'N/A'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Vocation:</Text>
          <Text style={styles.value}>{properties.Vocation || properties.Vocation_1 || 'N/A'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Type d'usage:</Text>
          <Text style={styles.value}>{properties.type_usag || properties.type_usa || 'N/A'}</Text>
        </View>
      </Card.Content>
    </Card>
  );

  const renderOccupationInfo = () => (
    <Card style={styles.card}>
      <Card.Content>
        <View style={styles.cardHeader}>
          <Ionicons name="compass" size={24} color="#795548" />
          <Text style={styles.cardTitle}>Limites de la Parcelle</Text>
        </View>
        <Divider style={styles.divider} />
        
        <View style={styles.infoRow}>
          <Text style={styles.label}>Nord:</Text>
          <Text style={styles.value}>{properties.Occup_nord || properties.Occup_N || 'N/A'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Sud:</Text>
          <Text style={styles.value}>{properties.Occup_sud || properties.Occup_S || 'N/A'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Est:</Text>
          <Text style={styles.value}>{properties.Occup_est || properties.Occup_E || 'N/A'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Ouest:</Text>
          <Text style={styles.value}>{properties.Occup_ouest || properties.Occup_O || 'N/A'}</Text>
        </View>
      </Card.Content>
    </Card>
  );

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.parcelNumber}>{properties.Num_parcel}</Text>
          <Chip 
            mode="outlined" 
            style={[
              styles.typeChip, 
              { borderColor: parcel.parcel_type === 'individuel' ? '#2196F3' : '#4CAF50' }
            ]}
            textStyle={{ 
              color: parcel.parcel_type === 'individuel' ? '#2196F3' : '#4CAF50', 
              fontSize: 12 
            }}
          >
            {parcel.parcel_type === 'individuel' ? 'Parcelle Individuelle' : 'Parcelle Collective'}
          </Chip>
        </View>
      </View>

      {/* Map */}
      {showMap && (
        <Card style={styles.mapCard}>
          <Card.Content style={styles.mapContainer}>
            <View style={styles.cardHeader}>
              <Ionicons name="location" size={24} color="#F44336" />
              <Text style={styles.cardTitle}>Géométrie de la Parcelle</Text>
              <TouchableOpacity 
                onPress={() => setShowMap(!showMap)}
                style={styles.toggleButton}
              >
                <Ionicons 
                  name={showMap ? "eye-off" : "eye"} 
                  size={20} 
                  color="#666" 
                />
              </TouchableOpacity>
            </View>
            {getPolygonCoordinates().length > 0 ? (
              <MapView
                provider={PROVIDER_GOOGLE}
                style={styles.map}
                region={getMapRegion()}
                mapType="satellite"
              >
                <Polygon
                  coordinates={getPolygonCoordinates()}
                  fillColor="rgba(255, 0, 0, 0.3)"
                  strokeColor="#FF0000"
                  strokeWidth={2}
                />
              </MapView>
            ) : (
              <Text style={{ color: '#f44336', marginTop: 16 }}>
                Géométrie non disponible pour cette parcelle.
              </Text>
            )}
          </Card.Content>
        </Card>
      )}

      {!showMap && (
        <Card style={styles.card}>
          <Card.Content>
            <Button 
              mode="outlined" 
              onPress={() => setShowMap(true)}
              icon="map"
              style={styles.showMapButton}
            >
              Afficher la carte
            </Button>
          </Card.Content>
        </Card>
      )}

      {/* Parcel Information */}
      {renderParcelInfo()}

      {/* Owner Information */}
      {parcel.parcel_type === 'individuel' ? (
        properties.Typ_pers === 'personne_morale' ? 
          renderPersonneMorale() : 
          renderPersonnePhysique()
      ) : (
        renderParcelCollectif()
      )}

      {/* Occupation Information */}
      {renderOccupationInfo()}

      <View style={styles.bottomSpacing} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: 'white',
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  parcelNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  typeChip: {
    marginLeft: 8,
  },
  mapCard: {
    margin: 16,
    marginBottom: 8,
    elevation: 3,
  },
  mapContainer: {
    padding: 0,
  },
  map: {
    width: '100%',
    height: 250,
    marginTop: 8,
  },
  card: {
    margin: 16,
    marginBottom: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
    flex: 1,
  },
  toggleButton: {
    padding: 8,
  },
  divider: {
    marginVertical: 12,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    width: 140,
    marginRight: 12,
  },
  value: {
    fontSize: 14,
    color: '#333',
    flex: 1,
    lineHeight: 20,
  },
  valueImportant: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2196F3',
    flex: 1,
  },
  showMapButton: {
    marginVertical: 8,
  },
  bottomSpacing: {
    height: 32,
  },
});

export default ParcelDetailScreen;