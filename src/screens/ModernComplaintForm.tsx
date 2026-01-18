import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
  Text,
  SafeAreaView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import theme from '../ui/theme';
import { EnhancedInput, EnhancedButton, EnhancedCard } from '../ui/components';
import { SafeIonicons } from '../components/SafeIcons';
import DatabaseManager from '../data/database';
import { Complaint } from '../types';

const RECEPTION_MODES = [
  'Auto saisine',
  'Visite de terrain',
  'Réunion',
  "Lettre à l'UCP",
  "Mail à l'UCP",
  'Appel téléphonique',
  'En personne',
  'Fax',
];

function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

interface ModernComplaintFormProps {
  route?: { params?: { parcelNumber?: string } };
  navigation: any;
}

type ComplaintFormState = Complaint & {
  parcelNumber: string;
  typeUsage: string;
  natureParcelle: string;
  date: string;
  activity: string;
  village: string;
  commune: string;
  complainantName: string;
  complainantSex: string;
  complainantId: string;
  complainantContact: string;
  complaintReason: string;
  complaintReceptionMode: string;
  complaintCategory: string;
  complaintDescription: string;
  expectedResolution: string;
};

export default function ModernComplaintForm({ route, navigation }: ModernComplaintFormProps) {
  const insets = useSafeAreaInsets();
  const [currentStep, setCurrentStep] = useState(1);
  const [form, setForm] = useState<ComplaintFormState>({
    id: generateId(),
    parcelNumber: (route?.params?.parcelNumber ?? '') as string,
    typeUsage: '',
    natureParcelle: '',
    date: new Date().toISOString().slice(0, 10),
    activity: '',
    village: '',
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
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

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

  const lastParcelLookupRef = React.useRef<string>('');
  React.useEffect(() => {
    const num = String(form.parcelNumber || '').trim();
    if (!num || num === lastParcelLookupRef.current) return;
    lastParcelLookupRef.current = num;

    let cancelled = false;
    const t = setTimeout(() => {
      (async () => {
        try {
          const parcel = await DatabaseManager.getParcelByNum?.(num);
          if (cancelled || !parcel) return;
          const meta = extractParcelMeta(parcel);
          if ((!meta.typeUsage && !meta.natureParcelle) || cancelled) return;
          setForm((prev) => ({
            ...prev,
            typeUsage: prev.typeUsage || meta.typeUsage || '',
            natureParcelle: prev.natureParcelle || meta.natureParcelle || '',
          }));
        } catch {
          // ignore lookup failures
        }
      })();
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [form.parcelNumber]);

  const handleChange = (key: keyof ComplaintFormState, value: string) => {
    setForm({ ...form, [key]: value });
    // Clear error when user starts typing
    if (errors[key]) {
      setErrors({ ...errors, [key]: '' });
    }
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      if (!form.parcelNumber.trim()) newErrors.parcelNumber = 'Numéro de parcelle requis';
      if (!form.date) newErrors.date = 'Date requise';
      if (!form.village.trim()) newErrors.village = 'Village requis';
    } else if (step === 2) {
      if (!form.complainantName.trim()) newErrors.complainantName = 'Nom du plaignant requis';
      if (!form.complainantContact.trim())
        newErrors.complainantContact = 'Contact requis';
    } else if (step === 3) {
      if (!form.complaintReason.trim()) newErrors.complaintReason = 'Motif requis';
      if (!form.complaintDescription.trim())
        newErrors.complaintDescription = 'Description requise';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleSubmit = async () => {
    if (!validateStep(3)) return;

    setLoading(true);
    try {
      // @ts-ignore
      await DatabaseManager.saveComplaint?.(form);
      setSubmitted(true);
      Alert.alert('Succès', 'Plainte enregistrée avec succès!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('Erreur', "Impossible d'enregistrer la plainte");
    } finally {
      setLoading(false);
    }
  };

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {[1, 2, 3].map((step) => (
        <View key={step} style={styles.stepContainer}>
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
              <Text style={[styles.stepNumber, currentStep >= step && styles.stepNumberActive]}>
                {step}
              </Text>
            )}
          </View>
          {step < 3 && (
            <View
              style={[styles.stepLine, currentStep > step && styles.stepLineActive]}
            />
          )}
        </View>
      ))}
    </View>
  );

  const renderStep1 = () => (
    <View>
      <Text style={styles.stepTitle}>Informations de la parcelle</Text>
      <Text style={styles.stepSubtitle}>Commencez par identifier la parcelle concernée</Text>

      <EnhancedInput
        label="Numéro de parcelle"
        value={form.parcelNumber}
        onChangeText={(text) => handleChange('parcelNumber', text)}
        icon="map"
        error={errors.parcelNumber}
        placeholder="Ex: 0522010200001"
      />

      <EnhancedInput
        label="Type d'usage (optionnel)"
        value={form.typeUsage}
        onChangeText={(text) => handleChange('typeUsage', text)}
        icon="briefcase"
        placeholder="Ex: Habitation / Agriculture"
      />

      <EnhancedInput
        label="Nature de la parcelle (optionnel)"
        value={form.natureParcelle}
        onChangeText={(text) => handleChange('natureParcelle', text)}
        icon="layers"
        placeholder="Ex: Bâti / Non bâti"
      />

      <EnhancedInput
        label="Date"
        value={form.date}
        onChangeText={(text) => handleChange('date', text)}
        icon="calendar"
        error={errors.date}
      />

      <EnhancedInput
        label="Village"
        value={form.village}
        onChangeText={(text) => handleChange('village', text)}
        icon="location"
        error={errors.village}
        placeholder="Nom du village"
      />

      <EnhancedInput
        label="Commune"
        value={form.commune}
        onChangeText={(text) => handleChange('commune', text)}
        icon="home"
        placeholder="Nom de la commune"
      />
    </View>
  );

  const renderStep2 = () => (
    <View>
      <Text style={styles.stepTitle}>Informations du plaignant</Text>
      <Text style={styles.stepSubtitle}>Qui dépose cette plainte?</Text>

      <EnhancedInput
        label="Nom complet"
        value={form.complainantName}
        onChangeText={(text) => handleChange('complainantName', text)}
        icon="person"
        error={errors.complainantName}
        placeholder="Prénom et nom"
      />

      <EnhancedInput
        label="Contact"
        value={form.complainantContact}
        onChangeText={(text) => handleChange('complainantContact', text)}
        icon="call"
        keyboardType="phone-pad"
        error={errors.complainantContact}
        placeholder="Téléphone ou email"
      />

      <EnhancedInput
        label="Pièce d'identité"
        value={form.complainantId}
        onChangeText={(text) => handleChange('complainantId', text)}
        icon="card"
        placeholder="Numéro de CNI (optionnel)"
      />
    </View>
  );

  const renderStep3 = () => (
    <View>
      <Text style={styles.stepTitle}>Détails de la plainte</Text>
      <Text style={styles.stepSubtitle}>Décrivez le motif de la plainte</Text>

      <EnhancedInput
        label="Motif de la plainte"
        value={form.complaintReason}
        onChangeText={(text) => handleChange('complaintReason', text)}
        icon="alert-circle"
        error={errors.complaintReason}
        placeholder="Résumé du problème"
      />

      <EnhancedInput
        label="Description détaillée"
        value={form.complaintDescription}
        onChangeText={(text) => handleChange('complaintDescription', text)}
        icon="document-text"
        multiline
        numberOfLines={5}
        error={errors.complaintDescription}
        placeholder="Expliquez la situation en détail..."
      />

      <EnhancedInput
        label="Résolution attendue"
        value={form.expectedResolution}
        onChangeText={(text) => handleChange('expectedResolution', text)}
        icon="flag"
        multiline
        numberOfLines={3}
        placeholder="Quelle solution attendez-vous?"
      />
    </View>
  );

  if (submitted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successContainer}>
          <LinearGradient
            colors={theme.colors.gradientSuccess}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.successCircle}
          >
            <SafeIonicons name="checkmark" size={80} color="#FFFFFF" />
          </LinearGradient>
          <Text style={styles.successTitle}>Plainte enregistrée!</Text>
          <Text style={styles.successSubtitle}>
            Votre plainte a été enregistrée avec succès. Nous vous contacterons prochainement.
          </Text>
          <EnhancedButton
            title="Retour"
            onPress={() => navigation.goBack()}
            variant="primary"
            icon="arrow-back"
            style={{ marginTop: theme.spacing(4) }}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.primary} />

      {/* Header */}
      <LinearGradient
        colors={theme.colors.gradientPrimary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Nouvelle plainte</Text>
          <Text style={styles.headerSubtitle}>
            Étape {currentStep} sur 3
          </Text>
        </View>
        {renderStepIndicator()}
      </LinearGradient>

      {/* Form */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <EnhancedCard style={styles.formCard}>
            {currentStep === 1 && renderStep1()}
            {currentStep === 2 && renderStep2()}
            {currentStep === 3 && renderStep3()}
          </EnhancedCard>
        </ScrollView>

        {/* Footer Actions */}
        <View style={styles.footer}>
          <View style={styles.footerButtons}>
            {currentStep > 1 && (
              <EnhancedButton
                title="Précédent"
                onPress={() => setCurrentStep(currentStep - 1)}
                variant="outline"
                icon="arrow-back"
                style={{ flex: 1, marginRight: theme.spacing(1) }}
              />
            )}
            {currentStep < 3 ? (
              <EnhancedButton
                title="Suivant"
                onPress={handleNext}
                variant="primary"
                icon="arrow-forward"
                iconPosition="right"
                style={{ flex: 1 }}
              />
            ) : (
              <EnhancedButton
                title="Enregistrer"
                onPress={handleSubmit}
                variant="success"
                loading={loading}
                icon="checkmark"
                style={{ flex: 1 }}
              />
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingTop: theme.spacing(2),
    paddingBottom: theme.spacing(3),
    paddingHorizontal: theme.spacing(2),
  },
  headerContent: {
    marginBottom: theme.spacing(3),
  },
  headerTitle: {
    fontSize: theme.typography.h2,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: theme.spacing(0.5),
  },
  headerSubtitle: {
    fontSize: theme.typography.body,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepCircle: {
    width: 40,
    height: 40,
    borderRadius: theme.radii.full,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleActive: {
    backgroundColor: '#FFFFFF',
  },
  stepCircleCompleted: {
    backgroundColor: theme.colors.success,
  },
  stepNumber: {
    fontSize: theme.typography.body,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  stepNumberActive: {
    color: theme.colors.primary,
  },
  stepLine: {
    width: 40,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: theme.spacing(1),
  },
  stepLineActive: {
    backgroundColor: theme.colors.success,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing(2),
    paddingBottom: theme.spacing(4),
  },
  formCard: {
    padding: theme.spacing(3),
  },
  stepTitle: {
    fontSize: theme.typography.h3,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing(0.5),
  },
  stepSubtitle: {
    fontSize: theme.typography.body,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing(3),
  },
  footer: {
    padding: theme.spacing(2),
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    ...theme.shadows.lg,
  },
  footerButtons: {
    flexDirection: 'row',
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing(4),
  },
  successCircle: {
    width: 160,
    height: 160,
    borderRadius: theme.radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing(4),
    ...theme.shadows.xl,
  },
  successTitle: {
    fontSize: theme.typography.h1,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing(1),
  },
  successSubtitle: {
    fontSize: theme.typography.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
});
