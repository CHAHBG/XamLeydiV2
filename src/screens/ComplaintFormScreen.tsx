import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Alert, Modal, TouchableOpacity, Text as RNText, useWindowDimensions } from 'react-native';
import { TextInput, Modal as RNModal } from 'react-native';
import * as ExpoCamera from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DatabaseManager from '../data/database';
import theme from '../theme';
import { Complaint } from '../types';
import SharedCOMMUNES from '../constants/communes';

// legacy dynamic import removed; use CameraView and permission hook

const RECEPTION_MODES = [
  'Auto saisine',
  'Visite de terrain',
  'Réunion',
  "Lettre à l\u2019UCP",
  'Mail à l\u2019UCP',
  'Appel téléphonique',
  'En personne',
  'Fax',
];

function generateId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

interface ComplaintFormScreenProps {
  route?: { params?: { parcelNumber?: string } };
  navigation: any;
}

export default function ComplaintFormScreen({ route, navigation }: ComplaintFormScreenProps) {
  const insets = useSafeAreaInsets();
  const windowDimensions = useWindowDimensions();

  const [form, setForm] = useState({
    id: generateId(),
    parcelNumber: (route?.params?.parcelNumber ?? '') as string,
    date: new Date().toISOString().slice(0, 10),
    activity: '',
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
  } as Complaint );

  const [loading, setLoading] = useState(false);
  const [communeMenuVisible, setCommuneMenuVisible] = useState(false);
  const [receptionMenuVisible, setReceptionMenuVisible] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  // camera permission handled via expo-camera hook when available
  const CameraModule: any = ExpoCamera as any;
  const CameraView: any = (CameraModule && (CameraModule.CameraView ?? CameraModule.Camera)) ?? null;
  const useCameraPermissionsHook: any = (CameraModule && (CameraModule.useCameraPermissions ?? CameraModule.useCameraPermissions)) ?? null;
  const [permission, requestPermission] = useCameraPermissionsHook ? useCameraPermissionsHook() : [null, async () => ({ granted: false })];
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  // Check database readiness on mount
  React.useEffect(() => {
    const checkDb = async () => {
      try {
        const test = await DatabaseManager.getAllParcels?.();
        setDbReady(Array.isArray(test));
        setDbError(null);
      } catch (e) {
        setDbReady(false);
        setDbError("La base de données n'est pas prête. Veuillez réessayer plus tard.");
      }
    };
    checkDb();
  }, []);

  const handleChange = (key: keyof Complaint, value: string) => setForm({ ...form, [key]: value });

  // permission is handled via resolved hook above
  const handleStartScan = async () => {
    try {
      if (!permission || !permission.granted) {
        const res = await requestPermission();
        if (!res || !res.granted) {
          Alert.alert('Permission requise', "La permission d'accès à la caméra est nécessaire pour scanner le QR code.");
          return;
        }
      }
      setIsScannerOpen(true);
    } catch (e) {
      Alert.alert('Erreur', "Impossible d'accéder à la caméra");
    }
  };

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    setForm({ ...form, parcelNumber: data });
    setIsScannerOpen(false);
    Alert.alert('QR Code scanné', `Numéro de parcelle: ${data}`);
  };

  /**
   * Handle the submission of the complaint form with improved validation and error handling
   */
  const handleSubmit = async () => {
    // Check database readiness
    if (!dbReady) {
      Alert.alert('Erreur', "La base de données n'est pas prête. Veuillez réessayer plus tard.");
      return;
    }
    
    // Validate required fields with more detailed feedback
    const requiredFields: [keyof Complaint, string][] = [
      ['complainantName', 'Nom du plaignant'],
      ['complaintReason', 'Motif de la plainte']
    ];
    
    const missingFields = requiredFields
      .filter(([field]) => !form[field])
      .map(([_, label]) => label);
      
    if (missingFields.length > 0) {
      Alert.alert(
        'Champs obligatoires', 
        `Veuillez remplir les champs suivants:\n- ${missingFields.join('\n- ')}`
      );
      return;
    }
    
    // Show loading state
    setLoading(true);
    
    try {
      // Prepare and optimize the form data before submission
      const optimizedForm = {
        ...form,
        id: form.id || generateId(),
        date: form.date || new Date().toISOString().slice(0, 10),
        // Remove any empty strings and convert to null for better storage
        ...Object.fromEntries(
          Object.entries(form)
            .filter(([_, v]) => v !== '')
            .map(([k, v]) => [k, v === '' ? null : v])
        )
      };
      
      // Submit to database
      const complaintId = await DatabaseManager.addComplaint(optimizedForm);
      
      // Show success message and navigate back
      Alert.alert(
        'Succès', 
        'Plainte enregistrée avec succès.', 
        [{ 
          text: 'OK', 
          onPress: () => navigation.goBack() 
        }]
      );
    } catch (e: any) {
      // Enhanced error handling with more detailed messages
      console.error('Form submission error:', e);
      
      let errorMessage = "Impossible d'enregistrer la plainte";
      if (e?.message) {
        errorMessage += `: ${e.message}`;
      } else if (typeof e === 'string') {
        errorMessage += `: ${e}`;
      } else {
        errorMessage += ". Erreur de base de données.";
      }
      
      Alert.alert('Erreur', errorMessage);
    } finally {
      // Always reset loading state
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.appColors.background }}>
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 140 }}>
        <RNText style={styles.section}>1. Information sur le sous-projet</RNText>

        {route?.params?.parcelNumber ? (
          <View style={styles.fieldSurface}>
            <TextInput
              value={form.parcelNumber ?? ''}
              editable={false}
              style={[styles.input, styles.disabledInput]}
              placeholder="Numéro de parcelle"
              placeholderTextColor={theme.appColors.subtext}
            />
          </View>
        ) : (
          <View style={{ marginBottom: 8 }}>
            <View style={styles.fieldSurface}>
              <TextInput
                value={form.parcelNumber ?? ''}
                onChangeText={(v: string) => handleChange('parcelNumber', v)}
                style={styles.input}
                placeholder="Numéro de parcelle"
                placeholderTextColor={theme.appColors.subtext}
              />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                <TouchableOpacity style={[styles.outlinedButton, { marginRight: 8 }]} onPress={handleStartScan}>
                  <RNText style={styles.outlinedButtonText}>Scanner QR</RNText>
                </TouchableOpacity>
                <TouchableOpacity style={styles.outlinedButton} onPress={() => setForm({ ...form, parcelNumber: '' })}>
                  <RNText style={styles.outlinedButtonText}>Effacer</RNText>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        <RNModal visible={isScannerOpen} animationType="slide" onRequestClose={() => setIsScannerOpen(false)}>
          <View style={{ flex: 1, backgroundColor: 'black' }}>
            <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 }}>
              <TouchableOpacity onPress={() => setIsScannerOpen(false)}>
                <RNText style={{ color: 'white' }}>Annuler</RNText>
              </TouchableOpacity>
              <RNText style={{ color: 'white', fontWeight: 'bold' }}>Scanner Numéro de parcelle</RNText>
              <View style={{ width: 60 }} />
            </View>
            <View style={{ flex: 1 }}>
              {permission && permission.granted && CameraView ? (
                <CameraView style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={handleBarCodeScanned} />
              ) : (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                  <RNText style={{ color: 'white' }}>Camera non disponible</RNText>
                </View>
              )}
            </View>
          </View>
        </RNModal>
        <View style={styles.fieldSurface}>
          <TextInput
            value={form.date}
            editable={false}
            style={[styles.input, styles.disabledInput]}
            placeholder="Date"
            placeholderTextColor={theme.appColors.subtext}
          />
          <TextInput
            value={form.activity}
            onChangeText={(v: string) => handleChange('activity', v)}
            style={styles.input}
            placeholder="Activité"
            placeholderTextColor={theme.appColors.subtext}
          />
        </View>

        {/* Commune Dropdown */}
        <View style={{ marginBottom: 8 }}>
          <TouchableOpacity style={styles.outlinedButton} onPress={() => setCommuneMenuVisible(true)}>
            <RNText style={styles.outlinedButtonText}>{form.commune || 'Sélectionner la commune'}</RNText>
          </TouchableOpacity>
          <RNModal
            visible={communeMenuVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setCommuneMenuVisible(false)}
          >
            <TouchableOpacity style={styles.modalOverlay} onPress={() => setCommuneMenuVisible(false)}>
              <View style={styles.dropdownMenu}>
                <TouchableOpacity onPress={() => { handleChange('commune', ''); setCommuneMenuVisible(false); }} style={styles.dropdownItem}>
                  <RNText>-- Aucun --</RNText>
                </TouchableOpacity>
                {SharedCOMMUNES.map((c) => (
                  <TouchableOpacity key={c} onPress={() => { handleChange('commune', c); setCommuneMenuVisible(false); }} style={styles.dropdownItem}>
                    <RNText>{c}</RNText>
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableOpacity>
          </RNModal>
        </View>

        <RNText style={styles.section}>2. Informations du plaignant</RNText>
        <View style={styles.fieldSurface}>
          <TextInput
            value={form.complainantName}
            onChangeText={(v: string) => handleChange('complainantName', v)}
            style={styles.input}
            placeholder="Nom du plaignant"
            placeholderTextColor={theme.appColors.subtext}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <RNText style={{ marginRight: 8 }}>Sexe :</RNText>
            <TouchableOpacity
              style={[styles.radioButton, form.complainantSex === 'M' && styles.radioButtonSelected]}
              onPress={() => handleChange('complainantSex', 'M')}
            >
              <RNText style={styles.radioLabel}>M</RNText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.radioButton, form.complainantSex === 'F' && styles.radioButtonSelected]}
              onPress={() => handleChange('complainantSex', 'F')}
            >
              <RNText style={styles.radioLabel}>F</RNText>
            </TouchableOpacity>
          </View>
          <TextInput
            value={form.complainantId}
            onChangeText={(v: string) => handleChange('complainantId', v)}
            style={styles.input}
            placeholder="Numéro d'identification (anonymat)"
            placeholderTextColor={theme.appColors.subtext}
          />
          <TextInput
            value={form.complainantContact}
            onChangeText={(v: string) => handleChange('complainantContact', v)}
            style={styles.input}
            placeholder="Coordonnées du plaignant"
            placeholderTextColor={theme.appColors.subtext}
          />
        </View>

        <RNText style={styles.section}>3. Motif de la plainte</RNText>
        <View style={styles.fieldSurface}>
          <TextInput
            value={form.complaintReason}
            onChangeText={(v: string) => handleChange('complaintReason', v)}
            style={styles.input}
            placeholder="Motif de la plainte"
            placeholderTextColor={theme.appColors.subtext}
            multiline
          />
          <RNText style={{ marginTop: 8 }}>Mode de réception :</RNText>
          <TouchableOpacity style={styles.outlinedButton} onPress={() => setReceptionMenuVisible(true)}>
            <RNText style={styles.outlinedButtonText}>{form.complaintReceptionMode || 'Sélectionner'}</RNText>
          </TouchableOpacity>
          <RNModal
            visible={receptionMenuVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setReceptionMenuVisible(false)}
          >
            <TouchableOpacity style={styles.modalOverlay} onPress={() => setReceptionMenuVisible(false)}>
              <View style={styles.dropdownMenu}>
                {RECEPTION_MODES.map((mode) => (
                  <TouchableOpacity key={mode} onPress={() => { handleChange('complaintReceptionMode', mode); setReceptionMenuVisible(false); }} style={styles.dropdownItem}>
                    <RNText>{mode}</RNText>
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableOpacity>
          </RNModal>
        </View>

        <RNText style={styles.section}>4. Catégorie de la plainte</RNText>
        <View style={styles.fieldSurface}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity
              style={[styles.radioButton, form.complaintCategory === 'sensible' && styles.radioButtonSelected]}
              onPress={() => handleChange('complaintCategory', 'sensible')}
            >
              <RNText style={styles.radioLabel}>Plainte sensible</RNText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.radioButton, form.complaintCategory === 'non_sensible' && styles.radioButtonSelected]}
              onPress={() => handleChange('complaintCategory', 'non_sensible')}
            >
              <RNText style={styles.radioLabel}>Plainte non sensible</RNText>
            </TouchableOpacity>
          </View>
        </View>

        <RNText style={styles.section}>5. Brève description</RNText>
        <View style={styles.fieldSurface}>
          <TextInput
            value={form.complaintDescription}
            onChangeText={(v: string) => handleChange('complaintDescription', v)}
            style={styles.input}
            placeholder="Description"
            placeholderTextColor={theme.appColors.subtext}
            multiline
          />
        </View>

        <RNText style={styles.section}>6. Réparation ou règlement attendu</RNText>
        <View style={styles.fieldSurface}>
          <TextInput
            value={form.expectedResolution}
            onChangeText={(v: string) => handleChange('expectedResolution', v)}
            style={styles.input}
            placeholder="Réparation ou règlement attendu"
            placeholderTextColor={theme.appColors.subtext}
            multiline
          />
        </View>
      </ScrollView>

      <View style={[styles.saveBar, { paddingBottom: Math.max(insets.bottom, 12) }]} pointerEvents="box-none">
        {dbError ? (
          <RNText style={{ color: '#E65100', fontWeight: 'bold', marginBottom: 8, textAlign: 'center' }}>{dbError}</RNText>
        ) : null}
        <TouchableOpacity style={styles.saveButton} onPress={handleSubmit} disabled={loading || !dbReady}>
          <RNText style={styles.saveButtonText}>{loading ? 'Enregistrement...' : 'Enregistrer la plainte'}</RNText>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  section: { fontWeight: '700', marginTop: 16, marginBottom: 8, fontSize: 16, color: theme.appColors.text },
  input: {
    marginBottom: 8,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 16,
    color: theme.appColors.text,
  },
  disabledInput: {
    backgroundColor: '#f0f0f0',
    color: theme.appColors.subtext,
  },
  fieldSurface: { padding: 12, borderRadius: 8, marginBottom: 12, backgroundColor: theme.appColors.surface, elevation: 2 },
  outlinedButton: {
    borderWidth: 1,
    borderColor: theme.appColors.primary,
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    minWidth: 44,
    marginBottom: 4,
  },
  outlinedButtonText: {
    color: theme.appColors.primary,
    fontWeight: '700',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownMenu: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 8,
    minWidth: 220,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  dropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  radioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 12,
    marginBottom: 4,
    backgroundColor: '#fff',
  },
  radioButtonSelected: {
    borderColor: theme.appColors.primary,
    backgroundColor: '#e6f0ff',
  },
  radioLabel: {
    color: theme.appColors.text,
    fontWeight: '700',
    fontSize: 15,
  },
  saveBar: { position: 'absolute', left: 12, right: 12, bottom: 12, alignItems: 'center' },
  saveButton: {
    width: '100%',
    borderRadius: 10,
    backgroundColor: theme.appColors.primary,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 18,
  },
});
