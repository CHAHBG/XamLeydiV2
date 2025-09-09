import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Linking } from 'react-native';
import theme from '../theme';
import Card from '../molecules/Card';
import InfoItem from '../atoms/InfoItem';
import { SafeIonicons } from '../../components/SafeIcons';

type AffectataireSummaryProps = {
  name: string;
  phone?: string;
  id?: string;
  residence?: string;
  onPress: () => void;
  testID?: string;
};

/**
 * AffectataireSummary - Shows a summary view of the primary affectataire with an option to view all
 * 
 * Displays the primary affectataire's information in a compact format with contact options
 * and a prompt to view all affectataires.
 * 
 * @param props.name - The full name of the affectataire to display
 * @param props.phone - Optional phone number, displays as clickable to make calls
 * @param props.id - Optional ID or card number
 * @param props.residence - Optional residence location
 * @param props.onPress - Function to call when tapping on the summary to view all affectataires
 * @param props.testID - Optional testID for testing purposes
 */
export const AffectataireSummary = ({ name, phone, id, residence, onPress, testID }: AffectataireSummaryProps) => {
  const handlePhoneCall = (phoneNumber: string) => {
    try {
      const normalized = String(phoneNumber).replace(/[^0-9+]/g, '');
      Linking.openURL(`tel:${normalized}`);
    } catch (e) {
      console.error('Error making phone call:', e);
    }
  };

  return (
    <TouchableOpacity onPress={onPress} style={styles.affPreview} testID={testID}>
      <View style={styles.affPreviewInfo}>
        <Text style={styles.affPreviewName}>{name}</Text>
        <View style={styles.affPreviewMeta}>
          {id ? (
            <View style={styles.metaItem}>
              <SafeIonicons name="card-outline" size={14} color={theme.colors.muted} />
              <Text style={styles.metaText}>ID: {id}</Text>
            </View>
          ) : null}
          
          {phone ? (
            <TouchableOpacity 
              style={styles.metaItem} 
              onPress={() => handlePhoneCall(phone)}
              testID={testID ? `${testID}-phone` : undefined}
            >
              <SafeIonicons name="call-outline" size={14} color={theme.colors.primary} />
              <Text style={[styles.metaText, styles.phoneLink]}>{phone}</Text>
            </TouchableOpacity>
          ) : null}
          
          {residence ? (
            <View style={styles.metaItem}>
              <SafeIonicons name="home-outline" size={14} color={theme.colors.muted} />
              <Text style={styles.metaText}>{residence}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
};

type MandataireInfoProps = {
  prenom: string;
  nom: string;
  age?: string;
  sexe?: string;
  residence?: string;
  numPiece?: string;
  telephone?: string;
  onCallPress?: (phone: string) => void;
};

/**
 * MandataireInfo - Component for displaying detailed mandataire information
 * 
 * Displays comprehensive information about a mandataire (representative)
 * with properly formatted fields and optional interactive elements like phone calls.
 * 
 * @param props.prenom - First name of the mandataire
 * @param props.nom - Last name of the mandataire
 * @param props.age - Optional age information
 * @param props.sexe - Optional gender information
 * @param props.residence - Optional residence or location information
 * @param props.numPiece - Optional ID card number
 * @param props.telephone - Optional telephone number
 * @param props.onCallPress - Function to call when tapping on the telephone number
 */
export const MandataireInfo = ({ 
  prenom, 
  nom, 
  age, 
  sexe, 
  residence, 
  numPiece, 
  telephone,
  onCallPress
}: MandataireInfoProps) => {
  return (
    <View style={styles.mandataireContainer}>
      <Text style={styles.sectionTitle}>Mandataire</Text>
      
      <InfoItem 
        label="Prénom:" 
        value={prenom || 'Non disponible'} 
      />
      
      <InfoItem 
        label="Nom:" 
        value={nom || 'Non disponible'} 
      />
      
      {age && (
        <InfoItem 
          label="Âge:" 
          value={age} 
          icon="calendar-outline"
        />
      )}
      
      {sexe && (
        <InfoItem 
          label="Sexe:" 
          value={sexe} 
        />
      )}
      
      {residence && (
        <InfoItem 
          label="Lieu de résidence:" 
          value={residence} 
          icon="home-outline"
        />
      )}
      
      {numPiece && (
        <InfoItem 
          label="Numéro de pièce:" 
          value={numPiece} 
          icon="card-outline"
        />
      )}
      
      {telephone && (
        <InfoItem 
          label="Téléphone:" 
          value={telephone} 
          icon="call-outline"
          isLink={true}
          onPress={() => onCallPress && onCallPress(telephone)}
          testID="mandataire-phone"
        />
      )}
    </View>
  );
};

/**
 * ParcelInfo - Component for displaying parcel information
 * 
 * Shows comprehensive information about a land parcel with all relevant
 * administrative details in a structured card format.
 * 
 * @param props.numParcel - The parcel identifier number
 * @param props.village - Optional village name where parcel is located
 * @param props.region - Optional administrative region
 * @param props.department - Optional department (administrative division)
 * @param props.commune - Optional commune (local administrative division)
 * @param props.vocation - Optional purpose/use classification of the parcel
 * @param props.typeUsage - Optional specific usage type
 */
export const ParcelInfo = ({
  numParcel,
  village,
  region,
  department,
  commune,
  vocation,
  typeUsage
}: {
  numParcel: string;
  village?: string;
  region?: string;
  department?: string;
  commune?: string;
  vocation?: string;
  typeUsage?: string;
}) => {
  return (
    <Card title="Informations Parcelle" icon="map" iconColor="#9C27B0">
      <View>
        <InfoItem 
          label="Numéro de parcelle:" 
          value={numParcel} 
          important={true}
        />
        
        <InfoItem 
          label="Village:" 
          value={village || 'Non disponible'} 
        />
        
        <InfoItem 
          label="Région:" 
          value={region || 'Non disponible'} 
        />
        
        <InfoItem 
          label="Département:" 
          value={department || 'Non disponible'} 
        />
        
        <InfoItem 
          label="Commune:" 
          value={commune || 'Non disponible'} 
        />
        
        <InfoItem 
          label="Vocation:" 
          value={vocation || 'Non disponible'} 
        />
        
        <InfoItem 
          label="Type d'usage:" 
          value={typeUsage || 'Non disponible'} 
        />
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  mandataireContainer: {
    marginBottom: theme.spacing(2)
  },
  sectionTitle: {
    fontSize: theme.typography.h3,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing(1)
  },
  affPreview: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.radii.sm,
    padding: theme.spacing(2),
    marginTop: theme.spacing(1)
  },
  affPreviewInfo: {
    marginBottom: theme.spacing(1)
  },
  affPreviewName: {
    fontSize: theme.typography.h3,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 4
  },
  affPreviewMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center'
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginVertical: 4
  },
  metaText: {
    fontSize: theme.typography.body,
    color: theme.colors.muted,
    marginLeft: 6
  },
  phoneLink: {
    color: theme.colors.primary
  },
  viewMoreText: {
    color: theme.colors.primary,
    fontSize: theme.typography.caption,
    textAlign: 'center',
    marginTop: theme.spacing(1)
  }
});
