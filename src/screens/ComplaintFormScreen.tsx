import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Alert, Modal, TouchableOpacity, Text as RNText, useWindowDimensions } from 'react-native';
import { TextInput, Modal as RNModal } from 'react-native';
import * as ExpoCamera from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DatabaseManager from '../data/database';
import theme from '../theme';
import { Complaint } from '../types';
import SharedCOMMUNES from '../constants/communes';
import VILLAGES from '../constants/villages';
// require Fuse to avoid missing types in this project setup
const Fuse: any = require('fuse.js');

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
  // Generate a UUID v4 for use as the local complaint id so it can be
  // reused as the remote id on the server. This keeps local and remote ids
  // identical and makes edits/upserts deterministic.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
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
    village: '',
    commune: '',
    complainantName: '',
    complainantSex: '',
    complainantId: '',
    complainantContact: '',
    complaintFunction: '',
    complaintReason: '',
    complaintReceptionMode: '',
    complaintCategory: '',
    complaintDescription: '',
    expectedResolution: '',
  } as Complaint );

  const [loading, setLoading] = useState(false);
  const [sentRemote, setSentRemote] = useState(false);
  const [communeMenuVisible, setCommuneMenuVisible] = useState(false);
  const [receptionMenuVisible, setReceptionMenuVisible] = useState(false);
  const [villageQuery, setVillageQuery] = useState('');
  const [villageSuggestions, setVillageSuggestions] = useState<string[]>([]);

  // Basic form validity: required fields must be present to allow immediate send
  const isFormValid = (String(form.complainantName || '').trim().length > 0) && (String(form.complaintReason || '').trim().length > 0);

  // Build a Fuse index for fuzzy search. Keep it stable across renders.
  const fuseRef = React.useRef<any | null>(null);
  if (!fuseRef.current) {
    fuseRef.current = new Fuse(VILLAGES, { includeScore: true, threshold: 0.4, keys: [] as any });
  }
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  // camera permission handled via expo-camera hook when available
  const CameraModule: any = ExpoCamera as any;
  const CameraView: any = (CameraModule && (CameraModule.CameraView ?? CameraModule.Camera)) ?? null;
  const useCameraPermissionsHook: any = (CameraModule && (CameraModule.useCameraPermissions ?? CameraModule.useCameraPermissions)) ?? null;
  const [permission, requestPermission] = useCameraPermissionsHook ? useCameraPermissionsHook() : [null, async () => ({ granted: false })];
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  // synchronous reentry guard to prevent double-submit before state updates flush
  const sendingNowRef = React.useRef(false);

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

  const handleChange = (key: keyof Complaint, value: string) => {
    // if user edits after a send, re-enable the Envoyer button
    if (sentRemote) setSentRemote(false);
    setForm({ ...form, [key]: value });
  };

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
        const savedId = await DatabaseManager.addComplaint(optimizedForm);
      
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

  const handleSendNow = async () => {
    // send the current draft to supabase (best-effort)
    // use sendingNowRef to synchronously block reentry (state updates are async)
    if (loading || sendingNowRef.current) return;
    sendingNowRef.current = true;
    try {
      setLoading(true);
      const optimizedForm = { ...form };

      // Ensure a stable remote_id so concurrent sends use the same id.
      const looksLikeUuid = (s: any) => typeof s === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(s);
      if (!optimizedForm.remote_id || !looksLikeUuid(optimizedForm.remote_id)) {
        const uuidv4 = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = (Math.random() * 16) | 0;
          const v = c === 'x' ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });
        optimizedForm.remote_id = uuidv4();
      }

      // mark that the automatic background submit should be skipped because
      // the UI is explicitly triggering a send now. This avoids the background
      // task and the manual send colliding and producing duplicate attempts.
      optimizedForm._skip_background_submit = true;

    // Persist locally (with remote_id) before sending so DatabaseManager.sendComplaint
    // can load the same remote_id when called by other concurrent code paths.
    const savedIdNow = await DatabaseManager.addComplaint(optimizedForm);

    const resp = await DatabaseManager.sendComplaint(savedIdNow);
      if (resp && resp.sent) {
        setSentRemote(true);
        Alert.alert('Envoyé', 'La plainte a été envoyée au serveur distant.');
      } else {
        // If the server reports the row already exists, treat as sent and inform user
        if (resp && (resp.code === 'already_exists' || resp.resp === 'already_exists' || resp.resp === 'already_sent')) {
          setSentRemote(true);
          Alert.alert('Info', 'Plainte déjà envoyée.');
        } else {
          Alert.alert('Erreur envoi', 'La plainte n\'a pas pu être envoyée. Elle sera réessayée en arrière-plan.');
        }
      }
    } catch (e) {
      console.warn('handleSendNow failed', e);
      Alert.alert('Erreur', 'Impossible d\'envoyer la plainte pour le moment.');
    } finally {
      setLoading(false);
      sendingNowRef.current = false;
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
                {SharedCOMMUNES.map((c, idx) => (
                  <TouchableOpacity key={`commune-${idx}-${c}`} onPress={() => { handleChange('commune', c); setCommuneMenuVisible(false); }} style={styles.dropdownItem}>
                    <RNText>{c}</RNText>
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableOpacity>
          </RNModal>
        </View>

        {/* Village typed input with live, non-blocking suggestions */}
        <View style={{ marginBottom: 8 }}>
          <TextInput
            value={form.village}
            onChangeText={(text: string) => {
              handleChange('village', text);
              setVillageQuery(text);
              const q = String(text || '').trim();
              if (!q) {
                setVillageSuggestions([]);
              } else {
                // Use Fuse fuzzy search for typo-tolerant suggestions
                const fuse = fuseRef.current!;
                const results = fuse.search(q, { limit: 50 });
                const suggestions: string[] = results.map((r: any) => r.item as string);
                setVillageSuggestions(suggestions);
              }
            }}
            style={styles.input}
            placeholder="Village (tapez pour suggérer)"
            placeholderTextColor={theme.appColors.subtext}
            // keep keyboard focus when interacting with suggestions
            keyboardAppearance="default"
          />

          {/* Inline suggestion list (non-modal) so typing isn't blocked. Scrollable and capped height. */}
          {villageSuggestions.length > 0 && (
            <View style={[styles.suggestionsContainer, { maxHeight: 240 }]}>
              <ScrollView keyboardShouldPersistTaps="handled">
                <TouchableOpacity onPress={() => { handleChange('village', ''); setVillageSuggestions([]); }} style={styles.dropdownItem}>
                  <RNText>-- Aucun --</RNText>
                </TouchableOpacity>
                {villageSuggestions.map((v) => {
                  const q = String(villageQuery || '').trim().toLowerCase();
                  const lower = v.toLowerCase();
                  const idx = q ? lower.indexOf(q) : -1;
                  let content: React.ReactNode = v;
                  if (idx >= 0 && q.length > 0) {
                    const before = v.slice(0, idx);
                    const match = v.slice(idx, idx + q.length);
                    const after = v.slice(idx + q.length);
                    content = (
                      <RNText>
                        <RNText>{before}</RNText>
                        <RNText style={styles.suggestionHighlight}>{match}</RNText>
                        <RNText>{after}</RNText>
                      </RNText>
                    );
                  }

                  return (
                    <TouchableOpacity key={v} onPress={() => { handleChange('village', v); setVillageSuggestions([]); }} style={styles.dropdownItem}>
                      {typeof content === 'string' ? <RNText>{content}</RNText> : content}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}
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

        <RNText style={styles.section}>4.1 Fonction concernée</RNText>
        <View style={styles.fieldSurface}>
          <TextInput
            value={form.complaintFunction}
            onChangeText={(v: string) => handleChange('complaintFunction', v)}
            style={styles.input}
            placeholder="Fonction / service concerné"
            placeholderTextColor={theme.appColors.subtext}
          />
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
        <View style={{ flexDirection: 'row', width: '100%' }}>
          <TouchableOpacity style={[styles.saveButton, { flex: 1, marginRight: 8 }]} onPress={handleSubmit} disabled={loading || !dbReady}>
            <RNText style={styles.saveButtonText}>{loading ? 'Enregistrement...' : 'Enregistrer la plainte'}</RNText>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.sendButton, { width: 140, opacity: (loading || !dbReady || sentRemote || !isFormValid) ? 0.6 : 1 }]} onPress={handleSendNow} disabled={loading || !dbReady || sentRemote || !isFormValid}>
            <RNText style={styles.sendButtonText}>{sentRemote ? 'Envoyé ✓' : 'Envoyer'}</RNText>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  section: { 
    fontWeight: '700', 
    marginTop: 18, 
    marginBottom: 10, 
    fontSize: 17, 
    color: theme.appColors.text,
    letterSpacing: -0.3,
  },
  input: {
    marginBottom: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: theme.appColors.text,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  disabledInput: {
    backgroundColor: '#F5F5F5',
    color: theme.appColors.subtext,
    borderColor: '#E8E8E8',
  },
  fieldSurface: { 
    padding: 16, 
    borderRadius: 16, 
    marginBottom: 14, 
    backgroundColor: '#FFFFFF',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  outlinedButton: {
    borderWidth: 1.5,
    borderColor: theme.appColors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    minWidth: 48,
    marginBottom: 6,
    shadowColor: theme.appColors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
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
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 10,
    minWidth: 240,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  suggestionsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 6,
    borderWidth: 1.5,
    borderColor: '#E8E8E8',
    marginTop: 8,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  suggestionHighlight: {
    backgroundColor: '#fff9c4',
    fontWeight: '700',
  },
  dropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  radioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#D0D0D0',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 12,
    marginBottom: 6,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  radioButtonSelected: {
    borderColor: theme.appColors.primary,
    backgroundColor: '#E8F4FD',
    borderWidth: 2,
    shadowOpacity: 0.12,
    elevation: 2,
  },
  radioLabel: {
    color: theme.appColors.text,
    fontWeight: '700',
    fontSize: 15,
  },
  saveBar: { 
    position: 'absolute', 
    left: 14, 
    right: 14, 
    bottom: 14, 
    alignItems: 'center',
  },
  saveButton: {
    width: '100%',
    borderRadius: 16,
    backgroundColor: theme.appColors.primary,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.appColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 18,
    letterSpacing: 0.5,
  },
  sendButton: {
    borderRadius: 16,
    backgroundColor: '#2E7D32',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2E7D32',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 17,
    letterSpacing: 0.5,
  },
});
