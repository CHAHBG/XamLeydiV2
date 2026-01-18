/**
 * XamLeydi v2.0 - Complaint Wizard
 * Multi-step form for submitting new complaints
 */

import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Animated,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Modal,
  Keyboard,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { SafeIonicons } from '../../components/SafeIcons';
import { useDesignTheme } from '../../ui/ThemeContext';
import {
  Button,
  Card,
  Badge,
  Input,
  SearchBar,
  ProgressIndicator,
} from '../../ui/components/ModernComponents';
import { spacing, radii, shadows, animation } from '../../ui/designSystem';
import DatabaseManager from '../../data/database';
import SharedCOMMUNES from '../../constants/communes';
import VILLAGES from '../../constants/villages';

// Require Fuse for fuzzy search
const Fuse: any = require('fuse.js');

// Reception modes (matches DB complaint_reception_mode)
const RECEPTION_MODES = [
  'Auto saisine',
  'Visite de terrain',
  'Réunion',
  "Lettre à l'UCP",
  'Mail à l\'UCP',
  'Appel téléphonique',
  'En personne',
  'Fax',
];

// Complaint categories (matches DB complaint_category)
const COMPLAINT_CATEGORIES = [
  { key: 'sensible', label: 'Sensible' },
  { key: 'non_sensible', label: 'Non sensible' },
];

interface SelectedParcel {
  id: number;
  num_parcel: string;
  owner_name: string;
  village: string;
}

interface Attachment {
  id: string;
  name: string;
  type: 'image' | 'document';
  uri: string;
  size?: number;
}

// ComplaintData interface - strictly matches DB schema
interface ComplaintData {
  parcel: SelectedParcel | null;
  attachments: Attachment[];
  // DB columns
  parcelNumber: string;          // parcel_number
  typeUsage: string;             // type_usage
  natureParcelle: string;        // nature_parcelle
  date: string;                  // date
  activity: string;              // activity
  village: string;               // village
  commune: string;               // commune
  complainantName: string;       // complainant_name
  complainantSex: string;        // complainant_sex
  complainantId: string;         // complainant_id
  complainantContact: string;    // complainant_contact
  complaintReason: string;       // complaint_reason
  complaintReceptionMode: string;// complaint_reception_mode
  complaintCategory: string;     // complaint_category
  complaintDescription: string;  // complaint_description
  expectedResolution: string;    // expected_resolution
  complaintFunction: string;     // complaint_function
}

const TOTAL_STEPS = 4;

export default function ComplaintWizardScreen() {
  const navigation = useNavigation();
  // Get params from navigation state directly (pick the most recent ComplaintWizard route)
  const wizardRoute: any = navigation
    .getState()
    ?.routes
    ?.slice()
    .reverse()
    .find((r: any) => r.name === 'ComplaintWizard');
  const parcelParam = wizardRoute?.params?.parcel;
  const parcelNumberParam = wizardRoute?.params?.parcelNumber;
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useDesignTheme();

  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const resolveParcelNumber = (data: any) => {
    // Check direct keys first (use || to skip empty strings)
    const direct =
      data?.parcelNumber ||
      data?.parcel_number ||
      data?.num_parcel ||
      data?.Num_parcel ||
      data?.numero_parcelle;
    if (direct && String(direct).trim()) return String(direct).trim();

    // Check nested parcel object
    const p = data?.parcel;
    if (p) {
      const nested =
        p?.num_parcel ||
        p?.Num_parcel ||
        p?.numero_parcelle ||
        p?.parcel_number ||
        p?.parcelNumber ||
        p?.numParcel ||
        p?.properties?.num_parcel ||
        p?.properties?.Num_parcel;
      if (nested && String(nested).trim()) return String(nested).trim();
    }

    // Check properties at top level
    const props = data?.properties;
    if (props) {
      const fromProps = props?.num_parcel || props?.Num_parcel || props?.numero_parcelle;
      if (fromProps && String(fromProps).trim()) return String(fromProps).trim();
    }

    return '';
  };

  // Form data - matches DB schema exactly
  const [complaintData, setComplaintData] = useState<ComplaintData>({
    parcel: parcelParam || null,
    attachments: [],
    parcelNumber: parcelParam?.num_parcel || parcelParam?.parcel_number || parcelParam?.parcelNumber || parcelNumberParam || '',
    typeUsage: '',
    natureParcelle: '',
    date: new Date().toISOString().slice(0, 10),
    activity: '',
    village: parcelParam?.village || '',
    commune: '',
    complainantName: '',
    complainantSex: '',
    complainantId: '',
    complainantContact: '',
    complaintReason: '',
    complaintReceptionMode: '',
    complaintCategory: '',
    complaintDescription: '',
    expectedResolution: '',
    complaintFunction: '',
  });

  // Dropdowns and autocomplete
  const [communeMenuVisible, setCommuneMenuVisible] = useState(false);
  const [receptionMenuVisible, setReceptionMenuVisible] = useState(false);
  const [villageSuggestions, setVillageSuggestions] = useState<string[]>([]);
  const fuseRef = React.useRef<any>(null);
  if (!fuseRef.current) {
    fuseRef.current = new Fuse(VILLAGES, { includeScore: true, threshold: 0.4, keys: [] as any });
  }

  const extractParcelMeta = (row: any): { typeUsage?: string; natureParcelle?: string } => {
    if (!row) return {};
    let props: any = null;
    try {
      if (row.properties && typeof row.properties === 'string') props = JSON.parse(row.properties);
      else if (row.properties && typeof row.properties === 'object') props = row.properties;
    } catch {
      props = null;
    }

    const pick = (obj: any, keys: string[]) => {
      for (const k of keys) {
        const v = obj?.[k];
        if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
      }
      return '';
    };

    const typeUsage =
      pick(row, ['type_usag', 'type_usage', 'type_usa', 'typeusage']) ||
      pick(props, ['type_usag', 'type_usage', 'type_usa', 'typeusage', 'Type_usage']);
    const natureParcelle =
      pick(row, ['nature_parcelle', 'nature', 'nature_parc']) ||
      pick(props, ['nature_parcelle', 'nature', 'nature_parc', 'Nature']);
    return { typeUsage, natureParcelle };
  };

  // Step 1: Parcel search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SelectedParcel[]>([]);
  const [searching, setSearching] = useState(false);

  const styles = useMemo(() => createStyles(theme, insets), [theme, insets]);

  const progressAnim = useRef(new Animated.Value(1)).current;

  const animateToStep = (step: number) => {
    Animated.timing(progressAnim, {
      toValue: step,
      duration: animation.duration.normal,
      useNativeDriver: false,
    }).start();
    setCurrentStep(step);
  };

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;

    setSearching(true);
    try {
      const results = await DatabaseManager.searchParcels(searchQuery, {
        limit: 10,
        offset: 0,
      });

      if (results && Array.isArray(results)) {
        setSearchResults(
          results.map((r: any) => ({
            id: r.id,
            num_parcel: r.num_parcel || r.numero_parcelle || '',
            owner_name: r.owner_name || r.nom_proprietaire || 'Non spécifié',
            village: r.village || '',
          }))
        );
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setSearching(false);
    }
  }, [searchQuery]);

  const selectParcel = async (parcel: SelectedParcel) => {
    // Extract parcel number from all possible locations
    const p = parcel as any;
    const parcelNum =
      p?.num_parcel ||
      p?.Num_parcel ||
      p?.numero_parcelle ||
      p?.parcel_number ||
      p?.parcelNumber ||
      p?.properties?.num_parcel ||
      p?.properties?.Num_parcel ||
      p?.properties?.numero_parcelle ||
      '';
    const parcelNumStr = String(parcelNum).trim();

    setComplaintData((prev) => ({ 
      ...prev, 
      parcel, 
      parcelNumber: parcelNumStr,
      village: parcel.village || p?.Village || p?.properties?.Village || prev.village,
    }));

    // Best-effort: auto-fill typeUsage/natureParcelle from the full parcel row.
    try {
      const full = await DatabaseManager.getParcelById?.(parcel.id);
      const meta = extractParcelMeta(full);
      if (meta.typeUsage || meta.natureParcelle) {
        setComplaintData((prev) => ({
          ...prev,
          typeUsage: prev.typeUsage || meta.typeUsage || '',
          natureParcelle: prev.natureParcelle || meta.natureParcelle || '',
        }));
      }
    } catch {
      // ignore
    }

    setSearchResults([]);
    setSearchQuery('');
  };

  // If user types a parcel number without selecting a result, try auto-fill (best-effort).
  const lastTypedLookupRef = useRef<string>('');
  React.useEffect(() => {
    const num = String(complaintData.parcelNumber || '').trim();
    if (!num || complaintData.parcel || num === lastTypedLookupRef.current) return;
    lastTypedLookupRef.current = num;

    let cancelled = false;
    const t = setTimeout(() => {
      (async () => {
        try {
          const full = await DatabaseManager.getParcelByNum?.(num);
          if (cancelled || !full) return;
          const meta = extractParcelMeta(full);
          if (!meta.typeUsage && !meta.natureParcelle) return;
          setComplaintData((prev) => ({
            ...prev,
            typeUsage: prev.typeUsage || meta.typeUsage || '',
            natureParcelle: prev.natureParcelle || meta.natureParcelle || '',
          }));
        } catch {
          // ignore
        }
      })();
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [complaintData.parcelNumber, complaintData.parcel]);

  const handleAddImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission refusée', "L'accès à la galerie est nécessaire.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsMultipleSelection: true,
      });

      if (!result.canceled && result.assets) {
        const newAttachments: Attachment[] = result.assets.map((asset: any, idx: number) => ({
          id: `img-${Date.now()}-${idx}`,
          name: asset.fileName || `Image_${idx + 1}.jpg`,
          type: 'image',
          uri: asset.uri,
          size: asset.fileSize,
        }));

        setComplaintData((prev) => ({
          ...prev,
          attachments: [...prev.attachments, ...newAttachments],
        }));
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Erreur', "Impossible de sélectionner l'image.");
    }
  };

  const handleAddDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        multiple: true,
      });

      if (result.canceled === false && result.assets) {
        const newAttachments: Attachment[] = result.assets.map((asset: any, idx: number) => ({
          id: `doc-${Date.now()}-${idx}`,
          name: asset.name,
          type: 'document',
          uri: asset.uri,
          size: asset.size,
        }));

        setComplaintData((prev) => ({
          ...prev,
          attachments: [...prev.attachments, ...newAttachments],
        }));
      }
    } catch (error) {
      console.error('Document picker error:', error);
      Alert.alert('Erreur', 'Impossible de sélectionner le document.');
    }
  };

  const removeAttachment = (id: string) => {
    setComplaintData((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((a) => a.id !== id),
    }));
  };

  const canProceed = () => {
    // Make it easy to progress - minimal required fields
    switch (currentStep) {
      case 1:
        // Step 1: parcel info - parcel number OR selected parcel (optional but helpful)
        return true; // Always allow proceeding, parcel is optional
      case 2:
        // Step 2: complainant - name is required
        return (complaintData.complainantName?.trim()?.length || 0) > 0;
      case 3:
        // Step 3: complaint details - reason OR description required
        return ((complaintData.complaintReason?.trim()?.length || 0) > 0) || 
               ((complaintData.complaintDescription?.trim()?.length || 0) > 0);
      case 4:
        // Step 4: summary - always can proceed to submit
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (currentStep < TOTAL_STEPS) {
      animateToStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      animateToStep(currentStep - 1);
    } else {
      navigation.goBack();
    }
  };

  const handleSubmit = async () => {
    if (!complaintData.complainantName?.trim() && !complaintData.parcel) {
      Alert.alert('Erreur', 'Veuillez au minimum identifier le plaignant ou la parcelle.');
      return;
    }

    setSubmitting(true);

    try {
      const reference = `DOSS-${new Date().getFullYear()}-${String(
        Date.now() % 1000000
      ).padStart(6, '0')}`;

      // If the user typed a numeric parcel id in the search field but didn't tap a result,
      // still persist it as parcel_number.
      const typedQuery = (searchQuery || '').trim();
      const typedParcelNumber = /^\d{10,}$/.test(typedQuery) ? typedQuery : '';
      const parcelNumberResolved = resolveParcelNumber(complaintData) || typedParcelNumber || '';

      // Persist selected parcel info in the JSON payload (even though it's not a DB column)
      // so we can always recover/display num_parcel later.
      const parcelToPersist = complaintData.parcel
        ? {
            id: complaintData.parcel.id,
            num_parcel: (complaintData.parcel as any).num_parcel || (complaintData.parcel as any).Num_parcel || '',
            owner_name: (complaintData.parcel as any).owner_name || (complaintData.parcel as any).ownerName || '',
            village: (complaintData.parcel as any).village || (complaintData.parcel as any).Village || '',
          }
        : null;

      // Build complaint object matching DB schema exactly
      const complaint = {
        reference,
        // DB columns
        parcel_number: parcelNumberResolved,
        type_usage: complaintData.typeUsage,
        nature_parcelle: complaintData.natureParcelle,
        date: complaintData.date,
        activity: complaintData.activity,
        village: complaintData.village,
        commune: complaintData.commune,
        complainant_name: complaintData.complainantName,
        complainant_sex: complaintData.complainantSex,
        complainant_id: complaintData.complainantId,
        complainant_contact: complaintData.complainantContact,
        complaint_reason: complaintData.complaintReason,
        complaint_reception_mode: complaintData.complaintReceptionMode,
        complaint_category: complaintData.complaintCategory,
        complaint_description: complaintData.complaintDescription,
        expected_resolution: complaintData.expectedResolution,
        complaint_function: complaintData.complaintFunction,
        status: 'pending',
        created_at: new Date().toISOString(),
        // Keep legacy/camelCase variants in JSON for UI compatibility
        parcelNumber: parcelNumberResolved,
        typeUsage: complaintData.typeUsage,
        natureParcelle: complaintData.natureParcelle,
        parcel: parcelToPersist,
        attachments: complaintData.attachments.map((a) => ({
          name: a.name,
          uri: a.uri,
          type: a.type,
        })),
      };

      await DatabaseManager.addComplaint?.(complaint);

      Alert.alert(
        'Plainte enregistrée',
        `Votre plainte a été enregistrée avec succès.\n\nRéférence: ${reference}`,
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('Plaintes'),
          },
        ]
      );
    } catch (error) {
      console.error('Submit error:', error);
      Alert.alert('Erreur', "Impossible d'enregistrer la plainte. Veuillez réessayer.");
    } finally {
      setSubmitting(false);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {[1, 2, 3, 4].map((step) => (
        <View key={step} style={styles.stepRow}>
          <View
            style={[
              styles.stepCircle,
              currentStep >= step && styles.stepCircleActive,
              currentStep > step && styles.stepCircleCompleted,
            ]}
          >
            {currentStep > step ? (
              <SafeIonicons name="checkmark" size={16} color="#FFFFFF" />
            ) : (
              <Text
                style={[
                  styles.stepNumber,
                  currentStep >= step && styles.stepNumberActive,
                ]}
              >
                {step}
              </Text>
            )}
          </View>
          {step < 4 && (
            <View
              style={[
                styles.stepLine,
                currentStep > step && styles.stepLineActive,
              ]}
            />
          )}
        </View>
      ))}
    </View>
  );

  const renderStep1 = () => (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepTitle}>Parcelle & Localisation</Text>
      <Text style={styles.stepDescription}>
        Sélectionnez la parcelle concernée et la localisation
      </Text>

      {/* Parcel Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Parcelle concernée *</Text>

        {complaintData.parcel ? (
          <Card style={styles.selectedParcelCard} theme={theme}>
            <View style={styles.selectedParcelHeader}>
              <Text style={styles.selectedParcelNumber}>
                {resolveParcelNumber(complaintData) || 'Non spécifiée'}
              </Text>
              <TouchableOpacity
                onPress={() =>
                  setComplaintData((prev) => ({ ...prev, parcel: null, parcelNumber: '' }))
                }
              >
                <SafeIonicons
                  name="close-circle"
                  size={22}
                  color={theme.colors.error}
                />
              </TouchableOpacity>
            </View>
            <Text style={styles.selectedParcelInfo}>
              {complaintData.parcel.owner_name}
            </Text>
            <Text style={styles.selectedParcelInfo}>
              {complaintData.parcel.village}
            </Text>
          </Card>
        ) : (
          <>
            <SearchBar
              value={searchQuery}
              onChangeText={(text) => {
                setSearchQuery(text);
                // If user types a numeric parcel id without selecting a result,
                // keep it in complaintData so it appears in the summary.
                const t = (text || '').trim();
                const isNumericParcel = /^\d{10,}$/.test(t);
                setComplaintData((prev) => {
                  if (prev.parcel) return prev;
                  return {
                    ...prev,
                    parcelNumber: isNumericParcel ? t : '',
                  };
                });
              }}
              placeholder="Rechercher une parcelle..."
              onSubmit={handleSearch}
              onClear={() => {
                setSearchQuery('');
                setSearchResults([]);
                setComplaintData((prev) => (prev.parcel ? prev : { ...prev, parcelNumber: '' }));
              }}
              theme={theme}
            />

            {searching && (
              <ActivityIndicator
                style={styles.searchLoader}
                color={theme.colors.primary}
              />
            )}

            {searchResults.map((parcel) => (
              <TouchableOpacity
                key={parcel.id}
                onPress={() => selectParcel(parcel)}
              >
                <Card style={styles.searchResultCard} theme={theme}>
                  <Text style={styles.searchResultNumber}>
                    {parcel.num_parcel}
                  </Text>
                  <Text style={styles.searchResultInfo}>
                    {parcel.owner_name} • {parcel.village}
                  </Text>
                </Card>
              </TouchableOpacity>
            ))}
          </>
        )}
      </View>

      {/* Type d'usage - Right after parcel selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Type d'usage</Text>
        <TextInput
          style={styles.textArea}
          value={complaintData.typeUsage}
          onChangeText={(text) => setComplaintData((prev) => ({ ...prev, typeUsage: text }))}
          placeholder="Ex: Habitation / Agriculture"
          placeholderTextColor={theme.colors.textTertiary}
        />
      </View>

      {/* Nature de la parcelle - Right after type d'usage */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Nature de la parcelle</Text>
        <TextInput
          style={styles.textArea}
          value={complaintData.natureParcelle}
          onChangeText={(text) => setComplaintData((prev) => ({ ...prev, natureParcelle: text }))}
          placeholder="Ex: Bâti / Non bâti"
          placeholderTextColor={theme.colors.textTertiary}
        />
      </View>

      {/* Village */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Village</Text>
        <TextInput
          style={styles.textArea}
          value={complaintData.village}
          onChangeText={(text) => {
            setComplaintData((prev) => ({ ...prev, village: text }));
            if (text.trim() && fuseRef.current) {
              const results = fuseRef.current.search(text, { limit: 10 });
              setVillageSuggestions(results.map((r: any) => r.item));
            } else {
              setVillageSuggestions([]);
            }
          }}
          onFocus={() => setVillageSuggestions([])} // Hide suggestions when focusing
          placeholder="Village (tapez pour suggérer)"
          placeholderTextColor={theme.colors.textTertiary}
        />
        {villageSuggestions.length > 0 && (
          <ScrollView style={styles.suggestionsScrollView} keyboardShouldPersistTaps="handled">
            {villageSuggestions.slice(0, 8).map((v: string) => (
              <TouchableOpacity
                key={v}
                onPress={() => {
                  setComplaintData((prev) => ({ ...prev, village: v }));
                  setVillageSuggestions([]);
                  Keyboard.dismiss();
                }}
                style={styles.suggestionItem}
              >
                <Text style={styles.suggestionText}>{v}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Commune Dropdown */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Commune</Text>
        <TouchableOpacity
          style={styles.dropdownButton}
          onPress={() => setCommuneMenuVisible(true)}
        >
          <Text style={complaintData.commune ? styles.dropdownText : styles.dropdownPlaceholder}>
            {complaintData.commune || 'Sélectionner la commune'}
          </Text>
          <SafeIonicons name="chevron-down" size={20} color={theme.colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Commune Modal */}
      <Modal visible={communeMenuVisible} transparent animationType="fade" onRequestClose={() => setCommuneMenuVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setCommuneMenuVisible(false)}>
          <View style={styles.dropdownMenu}>
            <ScrollView style={{ maxHeight: 300 }}>
              <TouchableOpacity onPress={() => { setComplaintData((prev) => ({ ...prev, commune: '' })); setCommuneMenuVisible(false); }} style={styles.dropdownItem}>
                <Text style={styles.dropdownItemText}>-- Aucun --</Text>
              </TouchableOpacity>
              {SharedCOMMUNES.map((c: string, idx: number) => (
                <TouchableOpacity key={`commune-${idx}`} onPress={() => { setComplaintData((prev) => ({ ...prev, commune: c })); setCommuneMenuVisible(false); }} style={styles.dropdownItem}>
                  <Text style={styles.dropdownItemText}>{c}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Activity */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Activité</Text>
        <TextInput
          style={styles.textArea}
          value={complaintData.activity}
          onChangeText={(text) =>
            setComplaintData((prev) => ({ ...prev, activity: text }))
          }
          placeholder="Activité (optionnel)"
          placeholderTextColor={theme.colors.textTertiary}
        />
      </View>

      {/* Date (auto-filled, readonly) */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Date d'enregistrement</Text>
        <TextInput
          style={[styles.textArea, { backgroundColor: theme.colors.surface }]}
          value={complaintData.date}
          editable={false}
          placeholder="Date"
          placeholderTextColor={theme.colors.textTertiary}
        />
      </View>
    </ScrollView>
  );

  // Step 2: Complainant Information
  const renderStep2 = () => (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepTitle}>Informations du plaignant</Text>
      <Text style={styles.stepDescription}>
        Identifiez la personne qui dépose la plainte
      </Text>

      {/* Complainant Name */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Nom du plaignant *</Text>
        <TextInput
          style={styles.textArea}
          value={complaintData.complainantName}
          onChangeText={(text) =>
            setComplaintData((prev) => ({ ...prev, complainantName: text }))
          }
          placeholder="Nom complet du plaignant"
          placeholderTextColor={theme.colors.textTertiary}
        />
      </View>

      {/* Sex */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sexe</Text>
        <View style={styles.sexButtonRow}>
          <TouchableOpacity
            style={[styles.sexButton, complaintData.complainantSex === 'M' && styles.sexButtonSelected]}
            onPress={() => setComplaintData((prev) => ({ ...prev, complainantSex: 'M' }))}
          >
            <Text style={[styles.sexButtonText, complaintData.complainantSex === 'M' && styles.sexButtonTextSelected]}>Masculin</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sexButton, complaintData.complainantSex === 'F' && styles.sexButtonSelected]}
            onPress={() => setComplaintData((prev) => ({ ...prev, complainantSex: 'F' }))}
          >
            <Text style={[styles.sexButtonText, complaintData.complainantSex === 'F' && styles.sexButtonTextSelected]}>Féminin</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ID */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Numéro d'identification</Text>
        <TextInput
          style={styles.textArea}
          value={complaintData.complainantId}
          onChangeText={(text) =>
            setComplaintData((prev) => ({ ...prev, complainantId: text }))
          }
          placeholder="CNI ou autre ID (optionnel)"
          placeholderTextColor={theme.colors.textTertiary}
        />
      </View>

      {/* Complaint Function */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Fonction du plaignant</Text>
        <TextInput
          style={styles.textArea}
          value={complaintData.complaintFunction}
          onChangeText={(text) =>
            setComplaintData((prev) => ({ ...prev, complaintFunction: text }))
          }
          placeholder="Ex: Propriétaire, Mandataire, Affectataire..."
          placeholderTextColor={theme.colors.textTertiary}
        />
      </View>

      {/* Contact */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Coordonnées du plaignant</Text>
        <TextInput
          style={styles.textArea}
          value={complaintData.complainantContact}
          onChangeText={(text) =>
            setComplaintData((prev) => ({ ...prev, complainantContact: text }))
          }
          placeholder="Téléphone ou email"
          placeholderTextColor={theme.colors.textTertiary}
          keyboardType="phone-pad"
        />
      </View>
    </ScrollView>
  );

  // Step 3: Complaint Details
  const renderStep3 = () => (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepTitle}>Motif & Description</Text>
      <Text style={styles.stepDescription}>
        Décrivez la nature et les détails de la plainte
      </Text>

      {/* Complaint Reason */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Motif de la plainte *</Text>
        <TextInput
          style={styles.textArea}
          value={complaintData.complaintReason}
          onChangeText={(text) =>
            setComplaintData((prev) => ({ ...prev, complaintReason: text }))
          }
          placeholder="Décrivez brièvement le motif"
          placeholderTextColor={theme.colors.textTertiary}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </View>

      {/* Reception Mode Dropdown */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Mode de réception</Text>
        <TouchableOpacity
          style={styles.dropdownButton}
          onPress={() => setReceptionMenuVisible(true)}
        >
          <Text style={complaintData.complaintReceptionMode ? styles.dropdownText : styles.dropdownPlaceholder}>
            {complaintData.complaintReceptionMode || 'Sélectionner le mode'}
          </Text>
          <SafeIonicons name="chevron-down" size={20} color={theme.colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Reception Modal */}
      <Modal visible={receptionMenuVisible} transparent animationType="fade" onRequestClose={() => setReceptionMenuVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setReceptionMenuVisible(false)}>
          <View style={styles.dropdownMenu}>
            {RECEPTION_MODES.map((mode: string) => (
              <TouchableOpacity key={mode} onPress={() => { setComplaintData((prev) => ({ ...prev, complaintReceptionMode: mode })); setReceptionMenuVisible(false); }} style={styles.dropdownItem}>
                <Text style={styles.dropdownItemText}>{mode}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Complaint Category */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Catégorie de la plainte</Text>
        <View style={styles.sexButtonRow}>
          <TouchableOpacity
            style={[styles.sexButton, complaintData.complaintCategory === 'sensible' && styles.sexButtonSelected]}
            onPress={() => setComplaintData((prev) => ({ ...prev, complaintCategory: 'sensible' }))}
          >
            <Text style={[styles.sexButtonText, complaintData.complaintCategory === 'sensible' && styles.sexButtonTextSelected]}>Sensible</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sexButton, complaintData.complaintCategory === 'non_sensible' && styles.sexButtonSelected]}
            onPress={() => setComplaintData((prev) => ({ ...prev, complaintCategory: 'non_sensible' }))}
          >
            <Text style={[styles.sexButtonText, complaintData.complaintCategory === 'non_sensible' && styles.sexButtonTextSelected]}>Non sensible</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Description */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Description détaillée</Text>
        <TextInput
          style={styles.textArea}
          value={complaintData.complaintDescription}
          onChangeText={(text) =>
            setComplaintData((prev) => ({ ...prev, complaintDescription: text }))
          }
          placeholder="Description complète de la plainte..."
          placeholderTextColor={theme.colors.textTertiary}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      </View>

      {/* Expected Resolution */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Réparation ou règlement attendu</Text>
        <TextInput
          style={styles.textArea}
          value={complaintData.expectedResolution}
          onChangeText={(text) =>
            setComplaintData((prev) => ({ ...prev, expectedResolution: text }))
          }
          placeholder="Quel résultat attendez-vous?"
          placeholderTextColor={theme.colors.textTertiary}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </View>
    </ScrollView>
  );

  // Step 4: Summary
  const renderStep4 = () => {
    return (
      <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.stepTitle}>Récapitulatif</Text>
        <Text style={styles.stepDescription}>
          Vérifiez les informations avant de soumettre votre plainte
        </Text>

        <Card style={styles.summaryCard} theme={theme}>
          {/* Parcel */}
          <View style={styles.summarySection}>
            <Text style={styles.summaryLabel}>Parcelle</Text>
            <Text style={styles.summaryValue}>
              {resolveParcelNumber(complaintData) || 'Non spécifiée'}
            </Text>
            {complaintData.village && (
              <Text style={styles.summarySubValue}>
                {complaintData.village}{complaintData.commune ? `, ${complaintData.commune}` : ''}
              </Text>
            )}
          </View>

          <View style={styles.summaryDivider} />

          {/* Complainant */}
          <View style={styles.summarySection}>
            <Text style={styles.summaryLabel}>Plaignant</Text>
            <Text style={styles.summaryValue}>
              {complaintData.complainantName || 'Non spécifié'}
            </Text>
            {complaintData.complainantSex && (
              <Text style={styles.summarySubValue}>
                Sexe: {complaintData.complainantSex === 'M' ? 'Masculin' : 'Féminin'}
              </Text>
            )}
            {complaintData.complainantContact && (
              <Text style={styles.summarySubValue}>
                Contact: {complaintData.complainantContact}
              </Text>
            )}
            {complaintData.complaintFunction && (
              <Text style={styles.summarySubValue}>
                Fonction: {complaintData.complaintFunction}
              </Text>
            )}
          </View>

          <View style={styles.summaryDivider} />

          {/* Category */}
          <View style={styles.summarySection}>
            <Text style={styles.summaryLabel}>Catégorie</Text>
            <Text style={styles.summaryValue}>
              {complaintData.complaintCategory === 'sensible' ? 'Sensible' : 
               complaintData.complaintCategory === 'non_sensible' ? 'Non sensible' : 
               'Non spécifiée'}
            </Text>
          </View>

          <View style={styles.summaryDivider} />

          {/* Motif & Description */}
          <View style={styles.summarySection}>
            <Text style={styles.summaryLabel}>Motif</Text>
            <Text style={styles.summaryDescription}>
              {complaintData.complaintReason || complaintData.complaintDescription || 'Aucun motif'}
            </Text>
          </View>

          {complaintData.expectedResolution && (
            <>
              <View style={styles.summaryDivider} />
              <View style={styles.summarySection}>
                <Text style={styles.summaryLabel}>Règlement attendu</Text>
                <Text style={styles.summaryDescription}>
                  {complaintData.expectedResolution}
                </Text>
              </View>
            </>
          )}

          {complaintData.attachments.length > 0 && (
            <>
              <View style={styles.summaryDivider} />
              <View style={styles.summarySection}>
                <Text style={styles.summaryLabel}>
                  Pièces jointes ({complaintData.attachments.length})
                </Text>
              </View>
            </>
          )}
        </Card>
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.colors.background}
      />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.headerBack}>
          <SafeIonicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nouvelle Plainte</Text>
        <View style={styles.headerBack} />
      </View>

      {/* Step Indicator */}
      {renderStepIndicator()}

      {/* Step Labels */}
      <View style={styles.stepLabels}>
        <Text
          style={[
            styles.stepLabelText,
            currentStep === 1 && styles.stepLabelActive,
          ]}
        >
          Parcelle
        </Text>
        <Text
          style={[
            styles.stepLabelText,
            currentStep === 2 && styles.stepLabelActive,
          ]}
        >
          Plaignant
        </Text>
        <Text
          style={[
            styles.stepLabelText,
            currentStep === 3 && styles.stepLabelActive,
          ]}
        >
          Motif
        </Text>
        <Text
          style={[
            styles.stepLabelText,
            currentStep === 4 && styles.stepLabelActive,
          ]}
        >
          Résumé
        </Text>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Step Content */}
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
        {currentStep === 4 && renderStep4()}

        {/* Navigation Buttons */}
        <View style={styles.footer}>
          {currentStep > 1 && (
            <Button
              title="Précédent"
              onPress={handleBack}
              variant="outline"
              style={styles.footerBtnBack}
              theme={theme}
            />
          )}
          {currentStep < TOTAL_STEPS ? (
            <Button
              title="Suivant"
              onPress={handleNext}
              variant="primary"
              disabled={!canProceed()}
              style={styles.footerBtnNext}
              theme={theme}
            />
          ) : (
            <Button
              title={submitting ? 'Envoi...' : 'Soumettre'}
              onPress={handleSubmit}
              variant="primary"
              disabled={submitting}
              loading={submitting}
              style={styles.footerBtnNext}
              theme={theme}
            />
          )}
        </View>
      </KeyboardAvoidingView>
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
      justifyContent: 'space-between',
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
    headerTitle: {
      fontSize: theme.typography.fontSize.h3,
      fontWeight: theme.typography.fontWeight.semiBold,
      color: theme.colors.text,
    },
    stepIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.lg,
      backgroundColor: theme.colors.surface,
    },
    stepRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    stepCircle: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.colors.backgroundAlt,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: theme.colors.border,
    },
    stepCircleActive: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primaryLight,
    },
    stepCircleCompleted: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    stepNumber: {
      fontSize: theme.typography.fontSize.body,
      fontWeight: theme.typography.fontWeight.semiBold,
      color: theme.colors.textSecondary,
    },
    stepNumberActive: {
      color: theme.colors.primary,
    },
    stepLine: {
      width: 60,
      height: 2,
      backgroundColor: theme.colors.border,
      marginHorizontal: spacing.sm,
    },
    stepLineActive: {
      backgroundColor: theme.colors.primary,
    },
    stepLabels: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    stepLabelText: {
      fontSize: theme.typography.fontSize.small,
      color: theme.colors.textTertiary,
    },
    stepLabelActive: {
      color: theme.colors.primary,
      fontWeight: theme.typography.fontWeight.semiBold,
    },
    keyboardView: {
      flex: 1,
    },
    stepContent: {
      flex: 1,
      padding: spacing.lg,
    },
    stepTitle: {
      fontSize: theme.typography.fontSize.h2,
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.text,
      marginBottom: spacing.xs,
    },
    stepDescription: {
      fontSize: theme.typography.fontSize.body,
      color: theme.colors.textSecondary,
      marginBottom: spacing.xl,
    },
    section: {
      marginBottom: spacing.xl,
    },
    sectionTitle: {
      fontSize: theme.typography.fontSize.h4,
      fontWeight: theme.typography.fontWeight.semiBold,
      color: theme.colors.text,
      marginBottom: spacing.md,
    },
    searchLoader: {
      marginVertical: spacing.md,
    },
    searchResultCard: {
      marginTop: spacing.sm,
      padding: spacing.md,
    },
    searchResultNumber: {
      fontSize: theme.typography.fontSize.h4,
      fontWeight: theme.typography.fontWeight.semiBold,
      color: theme.colors.text,
    },
    searchResultInfo: {
      fontSize: theme.typography.fontSize.small,
      color: theme.colors.textSecondary,
      marginTop: spacing.xs,
    },
    selectedParcelCard: {
      backgroundColor: theme.colors.primaryLight,
    },
    selectedParcelHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    selectedParcelNumber: {
      fontSize: theme.typography.fontSize.h3,
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.primary,
    },
    selectedParcelInfo: {
      fontSize: theme.typography.fontSize.body,
      color: theme.colors.textSecondary,
      marginTop: spacing.xs,
    },
    typeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginHorizontal: -spacing.xs,
    },
    typeCard: {
      width: '48%',
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: radii.lg,
      padding: spacing.md,
      alignItems: 'center',
      marginHorizontal: '1%',
      marginBottom: spacing.sm,
    },
    typeCardSelected: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primaryLight,
    },
    typeLabel: {
      fontSize: theme.typography.fontSize.small,
      color: theme.colors.textSecondary,
      marginTop: spacing.sm,
      textAlign: 'center',
    },
    typeLabelSelected: {
      color: theme.colors.primary,
      fontWeight: theme.typography.fontWeight.medium,
    },
    textArea: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: radii.md,
      padding: spacing.md,
      fontSize: theme.typography.fontSize.body,
      color: theme.colors.text,
      minHeight: 80,
    },
    charCount: {
      fontSize: theme.typography.fontSize.small,
      color: theme.colors.textTertiary,
      textAlign: 'right',
      marginTop: spacing.xs,
    },
    attachmentActions: {
      flexDirection: 'row',
      marginBottom: spacing.md,
    },
    attachmentBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: radii.md,
      padding: spacing.md,
      marginHorizontal: spacing.xs,
    },
    attachmentBtnText: {
      fontSize: theme.typography.fontSize.body,
      color: theme.colors.primary,
      marginLeft: spacing.sm,
    },
    attachmentsList: {
      marginTop: spacing.sm,
    },
    attachmentItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: radii.md,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    attachmentThumbnail: {
      width: 48,
      height: 48,
      borderRadius: radii.sm,
    },
    attachmentIcon: {
      width: 48,
      height: 48,
      borderRadius: radii.sm,
      backgroundColor: theme.colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    attachmentInfo: {
      flex: 1,
      marginLeft: spacing.md,
    },
    attachmentName: {
      fontSize: theme.typography.fontSize.body,
      color: theme.colors.text,
    },
    attachmentSize: {
      fontSize: theme.typography.fontSize.small,
      color: theme.colors.textTertiary,
      marginTop: spacing.xs,
    },
    summaryCard: {
      marginBottom: spacing.lg,
    },
    summarySection: {
      marginBottom: spacing.md,
    },
    summaryLabel: {
      fontSize: theme.typography.fontSize.small,
      color: theme.colors.textSecondary,
      marginBottom: spacing.xs,
    },
    summaryValue: {
      fontSize: theme.typography.fontSize.h4,
      fontWeight: theme.typography.fontWeight.semiBold,
      color: theme.colors.text,
      marginLeft: spacing.sm,
    },
    summarySubValue: {
      fontSize: theme.typography.fontSize.small,
      color: theme.colors.textSecondary,
      marginTop: spacing.xs,
    },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    summaryDescription: {
      fontSize: theme.typography.fontSize.body,
      color: theme.colors.text,
      lineHeight: 22,
    },
    summaryDivider: {
      height: 1,
      backgroundColor: theme.colors.border,
      marginVertical: spacing.md,
    },
    summaryAttachment: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: spacing.sm,
    },
    summaryAttachmentName: {
      fontSize: theme.typography.fontSize.small,
      color: theme.colors.textSecondary,
      marginLeft: spacing.sm,
    },
    disclaimerContainer: {
      flexDirection: 'row',
      backgroundColor: theme.colors.infoLight,
      borderRadius: radii.md,
      padding: spacing.md,
      marginBottom: spacing.lg,
    },
    disclaimerText: {
      flex: 1,
      fontSize: theme.typography.fontSize.small,
      color: theme.colors.info,
      marginLeft: spacing.sm,
      lineHeight: 18,
    },
    // New styles for complainant and complaint details
    sexButtonRow: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    sexButton: {
      flex: 1,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      alignItems: 'center',
    },
    sexButtonSelected: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primaryLight,
    },
    sexButtonText: {
      fontSize: theme.typography.fontSize.body,
      color: theme.colors.textSecondary,
    },
    sexButtonTextSelected: {
      color: theme.colors.primary,
      fontWeight: theme.typography.fontWeight.semiBold,
    },
    dropdownButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: radii.md,
      padding: spacing.md,
      minHeight: 48,
    },
    dropdownText: {
      fontSize: theme.typography.fontSize.body,
      color: theme.colors.text,
    },
    dropdownPlaceholder: {
      fontSize: theme.typography.fontSize.body,
      color: theme.colors.textTertiary,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.xl,
    },
    dropdownMenu: {
      width: '100%',
      maxHeight: 400,
      backgroundColor: theme.colors.surface,
      borderRadius: radii.lg,
      padding: spacing.sm,
    },
    dropdownItem: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    dropdownItemText: {
      fontSize: theme.typography.fontSize.body,
      color: theme.colors.text,
    },
    suggestionsContainer: {
      position: 'absolute',
      top: '100%',
      left: 0,
      right: 0,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: radii.md,
      maxHeight: 200,
      zIndex: 999,
      marginTop: 4,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        },
        android: {
          elevation: 4,
        },
      }),
    },
    suggestionsScrollView: {
      maxHeight: 200,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: radii.md,
      marginTop: spacing.xs,
    },
    suggestionItem: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    suggestionText: {
      fontSize: theme.typography.fontSize.body,
      color: theme.colors.text,
    },
    footer: {
      flexDirection: 'row',
      padding: spacing.lg,
      backgroundColor: theme.colors.surface,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      paddingBottom: insets.bottom + spacing.md,
    },
    footerBtnBack: {
      flex: 1,
      marginRight: spacing.sm,
    },
    footerBtnNext: {
      flex: 2,
    },
  });
