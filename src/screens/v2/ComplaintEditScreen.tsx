/**
 * XamLeydi v2.0 - Complaint Edit Screen
 * Modern complaint editing with all fields from database
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { SafeIonicons } from '../../components/SafeIcons';
import { useDesignTheme } from '../../ui/ThemeContext';
import { spacing, radii, shadows } from '../../ui/designSystem';
import DatabaseManager from '../../data/database';

interface ComplaintEditScreenProps {
  route?: { params?: { complaintId?: string; id?: string } };
  navigation?: any;
}

export default function ComplaintEditScreen({ route: routeProp }: ComplaintEditScreenProps) {
  const navigation = useNavigation();
  const params = (routeProp?.params || {}) as { complaintId?: string; id?: string };
  const complaintId = params.complaintId || params.id;
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useDesignTheme();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [complaint, setComplaint] = useState<any>(null);

  const styles = useMemo(() => createStyles(theme, insets), [theme, insets]);

  useEffect(() => {
    loadComplaint();
  }, [complaintId]);

  const loadComplaint = async () => {
    try {
      setLoading(true);
      if (!complaintId) {
        Alert.alert('Erreur', 'Aucun identifiant de plainte fourni.');
        navigation.goBack();
        return;
      }

      const data = await DatabaseManager.getComplaintById(complaintId);
      if (data) {
        setComplaint(data);
      } else {
        Alert.alert('Erreur', 'Plainte introuvable');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Load complaint error:', error);
      Alert.alert('Erreur', 'Impossible de charger la plainte');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      // Editing must put the complaint back in "pending" so it can be exported/sent again.
      // Also clear the local "sent" marker so the next sync will upsert/overwrite remotely.
      const updated = {
        ...complaint,
        status: 'pending',
        sent_remote: false,
        exported: false,
        exported_at: null,
        remote_response: '',
        updated_at: new Date().toISOString(),
      };
      await DatabaseManager.updateComplaint(updated);
      Alert.alert(
        'Succès',
        'La plainte a été mise à jour',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('Erreur', "Impossible d'enregistrer les modifications");
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: string, value: any) => {
    setComplaint((prev: any) => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar
          barStyle={isDark ? 'light-content' : 'dark-content'}
          backgroundColor={theme.colors.background}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!complaint) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.colors.background}
      />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <SafeIonicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Modifier la plainte</Text>
        <TouchableOpacity onPress={handleSave} style={styles.saveButton} disabled={saving}>
          <SafeIonicons
            name="checkmark"
            size={24}
            color={saving ? theme.colors.textTertiary : theme.colors.primary}
          />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Reference */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Référence</Text>
          <View style={styles.referenceCard}>
            <SafeIonicons name="document-text" size={20} color={theme.colors.primary} />
            <Text style={styles.referenceText}>
              {complaint.reference || 'Aucune référence'}
            </Text>
          </View>
        </View>

        {/* Localisation */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <SafeIonicons name="location" size={20} color={theme.colors.primary} />
            <Text style={styles.sectionTitle}>Localisation</Text>
          </View>

          <Text style={styles.label}>Date</Text>
          <TextInput
            style={styles.input}
            value={complaint.date || ''}
            onChangeText={(v) => updateField('date', v)}
            placeholder="Date"
            placeholderTextColor={theme.colors.textTertiary}
          />

          <Text style={styles.label}>Activité</Text>
          <TextInput
            style={styles.input}
            value={complaint.activity || ''}
            onChangeText={(v) => updateField('activity', v)}
            placeholder="Activité"
            placeholderTextColor={theme.colors.textTertiary}
          />

          <Text style={styles.label}>Village</Text>
          <TextInput
            style={styles.input}
            value={complaint.village || ''}
            onChangeText={(v) => updateField('village', v)}
            placeholder="Village"
            placeholderTextColor={theme.colors.textTertiary}
          />

          <Text style={styles.label}>Commune</Text>
          <TextInput
            style={styles.input}
            value={complaint.commune || ''}
            onChangeText={(v) => updateField('commune', v)}
            placeholder="Commune"
            placeholderTextColor={theme.colors.textTertiary}
          />

          <Text style={styles.label}>Numéro de parcelle</Text>
          <TextInput
            style={styles.input}
            value={complaint.parcel_number || complaint.parcelNumber || complaint.num_parcel || complaint.numero_parcelle || complaint.parcel?.num_parcel || complaint.parcel?.Num_parcel || complaint.parcel?.parcel_number || ''}
            onChangeText={(v) => {
              setComplaint((prev: any) => ({
                ...prev,
                parcel_number: v,
                parcelNumber: v,
              }));
            }}
            placeholder="Numéro de parcelle"
            placeholderTextColor={theme.colors.textTertiary}
          />

          <Text style={styles.label}>Type d'usage</Text>
          <TextInput
            style={styles.input}
            value={complaint.type_usage || complaint.typeUsage || ''}
            onChangeText={(v) => {
              updateField('type_usage', v);
              updateField('typeUsage', v);
            }}
            placeholder="Type d'usage"
            placeholderTextColor={theme.colors.textTertiary}
          />

          <Text style={styles.label}>Nature de la parcelle</Text>
          <TextInput
            style={styles.input}
            value={complaint.nature_parcelle || complaint.natureParcelle || ''}
            onChangeText={(v) => {
              updateField('nature_parcelle', v);
              updateField('natureParcelle', v);
            }}
            placeholder="Nature de la parcelle"
            placeholderTextColor={theme.colors.textTertiary}
          />
        </View>

        {/* Plaignant */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <SafeIonicons name="person" size={20} color={theme.colors.primary} />
            <Text style={styles.sectionTitle}>Informations du plaignant</Text>
          </View>

          <Text style={styles.label}>Nom complet</Text>
          <TextInput
            style={styles.input}
            value={complaint.complainant_name || complaint.complainantName || ''}
            onChangeText={(v) => {
              updateField('complainant_name', v);
              updateField('complainantName', v);
            }}
            placeholder="Nom du plaignant"
            placeholderTextColor={theme.colors.textTertiary}
          />

          <Text style={styles.label}>Sexe</Text>
          <View style={styles.genderContainer}>
            <TouchableOpacity
              style={[
                styles.genderButton,
                (complaint.complainant_sex || complaint.complainantSex) === 'M' && styles.genderButtonActive,
              ]}
              onPress={() => {
                updateField('complainant_sex', 'M');
                updateField('complainantSex', 'M');
              }}
            >
              <SafeIonicons
                name="male"
                size={20}
                color={
                  (complaint.complainant_sex || complaint.complainantSex) === 'M'
                    ? '#FFFFFF'
                    : theme.colors.textSecondary
                }
              />
              <Text
                style={[
                  styles.genderButtonText,
                  (complaint.complainant_sex || complaint.complainantSex) === 'M' &&
                  styles.genderButtonTextActive,
                ]}
              >
                Masculin
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.genderButton,
                (complaint.complainant_sex || complaint.complainantSex) === 'F' && styles.genderButtonActive,
              ]}
              onPress={() => {
                updateField('complainant_sex', 'F');
                updateField('complainantSex', 'F');
              }}
            >
              <SafeIonicons
                name="female"
                size={20}
                color={
                  (complaint.complainant_sex || complaint.complainantSex) === 'F'
                    ? '#FFFFFF'
                    : theme.colors.textSecondary
                }
              />
              <Text
                style={[
                  styles.genderButtonText,
                  (complaint.complainant_sex || complaint.complainantSex) === 'F' &&
                  styles.genderButtonTextActive,
                ]}
              >
                Féminin
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Numéro d'identification</Text>
          <TextInput
            style={styles.input}
            value={complaint.complainant_id || complaint.complainantId || ''}
            onChangeText={(v) => {
              updateField('complainant_id', v);
              updateField('complainantId', v);
            }}
            placeholder="CNI ou autre"
            placeholderTextColor={theme.colors.textTertiary}
          />

          <Text style={styles.label}>Contact</Text>
          <TextInput
            style={styles.input}
            value={complaint.complainant_contact || complaint.complainantContact || ''}
            onChangeText={(v) => {
              updateField('complainant_contact', v);
              updateField('complainantContact', v);
            }}
            placeholder="Téléphone ou email"
            placeholderTextColor={theme.colors.textTertiary}
            keyboardType="phone-pad"
          />
        </View>

        {/* Détails de la plainte */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <SafeIonicons name="alert-circle" size={20} color={theme.colors.primary} />
            <Text style={styles.sectionTitle}>Détails de la plainte</Text>
          </View>

          <Text style={styles.label}>Catégorie</Text>
          <TextInput
            style={styles.input}
            value={complaint.complaint_category || complaint.complaintCategory || ''}
            onChangeText={(v) => {
              updateField('complaint_category', v);
              updateField('complaintCategory', v);
            }}
            placeholder="Catégorie"
            placeholderTextColor={theme.colors.textTertiary}
          />

          <Text style={styles.label}>Mode de réception</Text>
          <TextInput
            style={styles.input}
            value={
              complaint.complaint_reception_mode || complaint.complaintReceptionMode || ''
            }
            onChangeText={(v) => {
              updateField('complaint_reception_mode', v);
              updateField('complaintReceptionMode', v);
            }}
            placeholder="Ex: Téléphone, Visite, Email"
            placeholderTextColor={theme.colors.textTertiary}
          />

          <Text style={styles.label}>Motif de la plainte</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={complaint.complaint_reason || complaint.complaintReason || ''}
            onChangeText={(v) => {
              updateField('complaint_reason', v);
              updateField('complaintReason', v);
            }}
            placeholder="Motif"
            placeholderTextColor={theme.colors.textTertiary}
            multiline
            numberOfLines={3}
          />

          <Text style={styles.label}>Description détaillée</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={
              complaint.complaint_description ||
              complaint.complaintDescription ||
              complaint.description ||
              ''
            }
            onChangeText={(v) => {
              updateField('complaint_description', v);
              updateField('complaintDescription', v);
              updateField('description', v);
            }}
            placeholder="Description complète de la plainte"
            placeholderTextColor={theme.colors.textTertiary}
            multiline
            numberOfLines={5}
          />

          <Text style={styles.label}>Résolution attendue</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={complaint.expected_resolution || complaint.expectedResolution || ''}
            onChangeText={(v) => {
              updateField('expected_resolution', v);
              updateField('expectedResolution', v);
            }}
            placeholder="Solution souhaitée"
            placeholderTextColor={theme.colors.textTertiary}
            multiline
            numberOfLines={3}
          />

          <Text style={styles.label}>Fonction de la plainte</Text>
          <TextInput
            style={styles.input}
            value={complaint.complaint_function || complaint.complaintFunction || ''}
            onChangeText={(v) => {
              updateField('complaint_function', v);
              updateField('complaintFunction', v);
            }}
            placeholder="Fonction"
            placeholderTextColor={theme.colors.textTertiary}
          />
        </View>

        {/* Pièces jointes */}
        {complaint.attachments && complaint.attachments.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <SafeIonicons name="attach" size={20} color={theme.colors.primary} />
              <Text style={styles.sectionTitle}>Pièces jointes</Text>
            </View>
            {complaint.attachments.map((att: any, idx: number) => (
              <View key={idx} style={styles.attachmentItem}>
                <SafeIonicons name="document" size={16} color={theme.colors.textSecondary} />
                <Text style={styles.attachmentText}>{att.name || `Fichier ${idx + 1}`}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Statut */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <SafeIonicons name="flag" size={20} color={theme.colors.primary} />
            <Text style={styles.sectionTitle}>Statut</Text>
          </View>
          <Text style={styles.helperText}>
            Toute modification remet automatiquement la plainte en attente.
          </Text>
        </View>
      </ScrollView>

      {/* Save Button */}
      <View style={styles.saveButtonContainer}>
        <TouchableOpacity
          style={styles.saveButtonMain}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <SafeIonicons name="checkmark-circle" size={20} color="#FFFFFF" />
              <Text style={styles.saveButtonText}>Enregistrer les modifications</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (theme: any, insets: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    loadingText: {
      marginTop: spacing.md,
      fontSize: theme.typography.fontSize.body,
      color: theme.colors.textSecondary,
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
    backButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      flex: 1,
      fontSize: theme.typography.fontSize.h3,
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.text,
      marginLeft: spacing.md,
    },
    saveButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: spacing.lg,
      paddingBottom: insets.bottom + 80,
    },
    section: {
      marginBottom: spacing.xl,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.md,
      gap: spacing.sm,
    },
    sectionTitle: {
      fontSize: theme.typography.fontSize.h4,
      fontWeight: theme.typography.fontWeight.semiBold,
      color: theme.colors.text,
    },
    referenceCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.md,
      backgroundColor: theme.colors.primaryLight,
      borderRadius: radii.md,
      gap: spacing.sm,
    },
    referenceText: {
      fontSize: theme.typography.fontSize.body,
      fontWeight: theme.typography.fontWeight.medium,
      color: theme.colors.primary,
    },
    label: {
      fontSize: theme.typography.fontSize.small,
      fontWeight: theme.typography.fontWeight.medium,
      color: theme.colors.textSecondary,
      marginBottom: spacing.xs,
      marginTop: spacing.sm,
    },
    helperText: {
      fontSize: theme.typography.fontSize.small,
      color: theme.colors.textSecondary,
      lineHeight: 18,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: radii.md,
      padding: spacing.md,
      fontSize: theme.typography.fontSize.body,
      color: theme.colors.text,
      backgroundColor: theme.colors.surface,
    },
    textArea: {
      minHeight: 100,
      textAlignVertical: 'top',
    },
    genderContainer: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    genderButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: radii.md,
      backgroundColor: theme.colors.surface,
      gap: spacing.xs,
    },
    genderButtonActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    genderButtonText: {
      fontSize: theme.typography.fontSize.body,
      fontWeight: theme.typography.fontWeight.medium,
      color: theme.colors.textSecondary,
    },
    genderButtonTextActive: {
      color: '#FFFFFF',
    },
    statusContainer: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    statusButton: {
      flex: 1,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: radii.md,
      backgroundColor: theme.colors.surface,
      alignItems: 'center',
    },
    statusButtonPending: {
      backgroundColor: theme.colors.warning,
      borderColor: theme.colors.warning,
    },
    statusButtonValidated: {
      backgroundColor: theme.colors.success,
      borderColor: theme.colors.success,
    },
    statusButtonRejected: {
      backgroundColor: theme.colors.error,
      borderColor: theme.colors.error,
    },
    statusButtonText: {
      fontSize: theme.typography.fontSize.small,
      fontWeight: theme.typography.fontWeight.medium,
      color: theme.colors.textSecondary,
    },
    statusButtonTextActive: {
      color: '#FFFFFF',
    },
    attachmentItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.sm,
      backgroundColor: theme.colors.backgroundAlt,
      borderRadius: radii.sm,
      marginBottom: spacing.xs,
      gap: spacing.sm,
    },
    attachmentText: {
      fontSize: theme.typography.fontSize.small,
      color: theme.colors.textSecondary,
    },
    saveButtonContainer: {
      position: 'absolute',
      bottom: insets.bottom,
      left: 0,
      right: 0,
      padding: spacing.lg,
      backgroundColor: theme.colors.surface,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    saveButtonMain: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.md,
      backgroundColor: theme.colors.primary,
      borderRadius: radii.md,
      gap: spacing.sm,
      ...shadows.medium,
    },
    saveButtonText: {
      fontSize: theme.typography.fontSize.body,
      fontWeight: theme.typography.fontWeight.bold,
      color: '#FFFFFF',
    },
  });
