import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Alert, TouchableOpacity, Text as RNText, ScrollView, ActivityIndicator, SafeAreaView } from 'react-native';
import { TextInput } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeMaterialCommunityIcons } from '../components/SafeIcons';
import DatabaseManager from '../data/database';
import theme from '../theme';

interface Props {
  route?: { params?: { id?: string } };
  navigation: any;
}

export default function ComplaintEditScreen({ route, navigation }: Props) {
  const id = route?.params?.id;
  const [loading, setLoading] = useState(false);
  const [complaint, setComplaint] = useState<any | null>(null);
  const [originalParcelNumber, setOriginalParcelNumber] = useState<string | null>(null);
  const [complaintList, setComplaintList] = useState<any[] | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (id) {
          const c = await DatabaseManager.getComplaintById(id);
            if (mounted) {
              setComplaint(c);
              setOriginalParcelNumber(c?.parcelNumber ?? null);
            }
        } else {
          // no id provided: load list of local complaints for selection
          const list = await DatabaseManager.getAllComplaints();
          if (mounted) setComplaintList(Array.isArray(list) ? list : []);
        }
      } catch (e) {
        console.warn('Failed to load complaint(s)', e);
        Alert.alert('Erreur', 'Impossible de charger les plaintes');
      }
    })();
    return () => { mounted = false; };
  }, [id]);

  if (!complaint) {
    // If we have a complaint list (no id mode), show selection UI
    if (complaintList) {
      return (
        <SafeAreaView style={styles.safeArea}>
          <LinearGradient
            colors={['#A02020', '#D32F2F']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            <SafeMaterialCommunityIcons name="file-document-edit" size={48} color="#FFFFFF" style={{ opacity: 0.9 }} />
            <RNText style={styles.headerTitle}>Sélectionner une plainte</RNText>
            <RNText style={styles.headerSubtitle}>Choisissez la plainte à modifier</RNText>
          </LinearGradient>
          <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
            {complaintList.length === 0 ? (
              <View style={styles.emptyState}>
                <SafeMaterialCommunityIcons name="inbox" size={64} color={theme.appColors.subtext} />
                <RNText style={styles.emptyText}>Aucune plainte locale trouvée</RNText>
              </View>
            ) : (
              complaintList.map((c) => (
                <TouchableOpacity key={c.id || String(Math.random())} style={styles.complaintCard} onPress={() => setComplaint(c)}>
                  <View style={styles.complaintCardHeader}>
                    <SafeMaterialCommunityIcons name="account" size={24} color={theme.appColors.primary} />
                    <RNText style={styles.complaintCardTitle}>{c.complainantName || 'Sans nom'}</RNText>
                  </View>
                  <View style={styles.complaintCardInfo}>
                    <View style={styles.infoRow}>
                      <SafeMaterialCommunityIcons name="map-marker" size={16} color={theme.appColors.subtext} />
                      <RNText style={styles.infoText}>{c.village || 'Non spécifié'}</RNText>
                    </View>
                    <View style={styles.infoRow}>
                      <SafeMaterialCommunityIcons name="file-document" size={16} color={theme.appColors.subtext} />
                      <RNText style={styles.infoText}>{c.parcelNumber || 'N/A'}</RNText>
                    </View>
                  </View>
                  <View style={styles.complaintCardFooter}>
                    <RNText style={styles.viewDetailsText}>Modifier</RNText>
                    <SafeMaterialCommunityIcons name="chevron-right" size={20} color={theme.appColors.primary} />
                  </View>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </SafeAreaView>
      );
    }
    return (
      <SafeAreaView style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.appColors.primary} />
        <RNText style={{ marginTop: 16, color: theme.appColors.subtext }}>Chargement...</RNText>
      </SafeAreaView>
    );
  }

  const handleChange = (k: string, v: any) => setComplaint({ ...complaint, [k]: v });

  const handleSave = async () => {
    try {
      setLoading(true);
      await DatabaseManager.updateComplaint(complaint);
      Alert.alert('Sauvegardé', 'La plainte a été mise à jour localement', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (e) {
      console.warn('update failed', e);
      Alert.alert('Erreur', "Impossible d'enregistrer la plainte");
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (loading) return;
    try {
      setLoading(true);
      const currentParcel = complaint?.parcelNumber ?? null;
      const originalParcel = originalParcelNumber ?? null;

      const looksLikeUuid = (s: any) => typeof s === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(s);

      if (currentParcel !== null && originalParcel !== null && String(currentParcel).trim() !== String(originalParcel).trim()) {
        Alert.alert(
          'Créer une nouvelle plainte?',
          'Le numéro de parcelle a changé. Voulez-vous créer une nouvelle plainte plutôt que de modifier l\'ancienne?',
          [
            { text: 'Annuler', style: 'cancel', onPress: () => {} },
            {
              text: 'Créer',
              onPress: async () => {
                try {
                  const uuidv4 = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                    const r = (Math.random() * 16) | 0;
                    const v = c === 'x' ? r : (r & 0x3) | 0x8;
                    return v.toString(16);
                  });
                  const newComplaint = { ...complaint } as any;
                  newComplaint.id = uuidv4();
                  delete newComplaint.remote_id;
                  delete newComplaint.sent_remote;
                  delete newComplaint.remote_response;

                  const newId = await DatabaseManager.addComplaint(newComplaint);
                  const sendResp = await DatabaseManager.sendComplaint(newId);
                  if (sendResp && sendResp.sent) {
                    Alert.alert('Envoyé', 'Une nouvelle plainte a été créée et envoyée.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
                  } else {
                    Alert.alert('En file', "La nouvelle plainte n'a pas pu être envoyée immédiatement.");
                  }
                } catch (er) {
                  console.warn('failed creating new complaint', er);
                  Alert.alert('Erreur', "Impossible de créer/envoyer la nouvelle plainte.");
                }
              }
            }
          ]
        );
      } else {
        if (!complaint.remote_id || !looksLikeUuid(complaint.remote_id)) {
          complaint.remote_id = complaint.remote_id || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
          });
        }

        await DatabaseManager.updateComplaint(complaint);
        const resp = await DatabaseManager.sendComplaint(complaint.id);
        if (resp && resp.sent) {
          Alert.alert('Plainte mise à jour', 'La plainte a été mise à jour et envoyée.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
        } else if (resp && (resp.code === 'already_exists' || resp.resp === 'already_exists' || resp.resp === 'already_sent')) {
          Alert.alert('Plainte mise à jour', 'La plainte a déjà été envoyée (mise à jour).', [{ text: 'OK', onPress: () => navigation.goBack() }]);
        } else {
          const details = resp && resp.resp ? String(resp.resp).slice(0, 300) : null;
          Alert.alert('En file', `La plainte n'a pas pu être envoyée immédiatement.${details ? '\n\nDétails: ' + details : ''}`);
        }
      }
    } catch (e) {
      console.warn('send failed', e);
      const errAny: any = e;
      const msg = (errAny && (typeof errAny === 'object') && errAny.message) ? String(errAny.message) : String(errAny || 'Impossible d\'envoyer la plainte maintenant');
      Alert.alert('Erreur', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={['#A02020', '#D32F2F']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <SafeMaterialCommunityIcons name="pencil" size={48} color="#FFFFFF" style={{ opacity: 0.9 }} />
        <RNText style={styles.headerTitle}>Modifier la plainte</RNText>
        <RNText style={styles.headerSubtitle}>Éditez les informations ci-dessous</RNText>
      </LinearGradient>

      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={styles.formCard}>
          <View style={styles.formSection}>
            <View style={styles.sectionHeader}>
              <SafeMaterialCommunityIcons name="map-marker" size={20} color={theme.appColors.primary} />
              <RNText style={styles.sectionTitle}>Localisation</RNText>
            </View>

            <RNText style={styles.label}>Numéro de parcelle</RNText>
            <TextInput 
              value={complaint.parcelNumber || ''} 
              onChangeText={(v) => handleChange('parcelNumber', v)} 
              placeholder="Numéro de parcelle" 
              style={styles.input} 
              placeholderTextColor={theme.appColors.subtext}
            />

            <RNText style={styles.label}>Village</RNText>
            <TextInput 
              value={complaint.village || ''} 
              onChangeText={(v) => handleChange('village', v)} 
              placeholder="Village" 
              style={styles.input} 
              placeholderTextColor={theme.appColors.subtext}
            />

            <RNText style={styles.label}>Commune</RNText>
            <TextInput 
              value={complaint.commune || ''} 
              onChangeText={(v) => handleChange('commune', v)} 
              placeholder="Commune" 
              style={styles.input} 
              placeholderTextColor={theme.appColors.subtext}
            />
          </View>

          <View style={styles.formSection}>
            <View style={styles.sectionHeader}>
              <SafeMaterialCommunityIcons name="account" size={20} color={theme.appColors.primary} />
              <RNText style={styles.sectionTitle}>Plaignant</RNText>
            </View>

            <RNText style={styles.label}>Nom du plaignant</RNText>
            <TextInput 
              value={complaint.complainantName || ''} 
              onChangeText={(v) => handleChange('complainantName', v)} 
              placeholder="Nom du plaignant" 
              style={styles.input} 
              placeholderTextColor={theme.appColors.subtext}
            />
          </View>

          <View style={styles.formSection}>
            <View style={styles.sectionHeader}>
              <SafeMaterialCommunityIcons name="alert-circle" size={20} color={theme.appColors.primary} />
              <RNText style={styles.sectionTitle}>Détails de la plainte</RNText>
            </View>

            <RNText style={styles.label}>Motif</RNText>
            <TextInput 
              value={complaint.complaintReason || ''} 
              onChangeText={(v) => handleChange('complaintReason', v)} 
              placeholder="Motif de la plainte" 
              style={[styles.input, styles.textArea]} 
              multiline 
              numberOfLines={3}
              placeholderTextColor={theme.appColors.subtext}
            />

            <RNText style={styles.label}>Description</RNText>
            <TextInput 
              value={complaint.complaintDescription || ''} 
              onChangeText={(v) => handleChange('complaintDescription', v)} 
              placeholder="Description détaillée" 
              style={[styles.input, styles.textArea]} 
              multiline 
              numberOfLines={4}
              placeholderTextColor={theme.appColors.subtext}
            />

            <RNText style={styles.label}>Réparation attendue</RNText>
            <TextInput 
              value={complaint.expectedResolution || ''} 
              onChangeText={(v) => handleChange('expectedResolution', v)} 
              placeholder="Solution souhaitée" 
              style={[styles.input, styles.textArea]} 
              multiline 
              numberOfLines={3}
              placeholderTextColor={theme.appColors.subtext}
            />
          </View>
        </View>
      </ScrollView>

      <View style={styles.actionBar}>
        <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={loading}>
          <LinearGradient
            colors={[theme.appColors.primary, '#D32F2F']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.buttonGradient}
          >
            <SafeMaterialCommunityIcons name="content-save" size={20} color="#FFFFFF" />
            <RNText style={styles.buttonText}>{loading ? 'Enregistrement...' : 'Enregistrer'}</RNText>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity style={styles.sendButton} onPress={handleSend} disabled={loading}>
          <LinearGradient
            colors={['#2e7d32', '#4CAF50']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.buttonGradient}
          >
            <SafeMaterialCommunityIcons name="send" size={20} color="#FFFFFF" />
            <RNText style={styles.buttonText}>{loading ? 'Envoi...' : 'Envoyer'}</RNText>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.appColors.background,
  },
  header: {
    paddingTop: 20,
    paddingBottom: 24,
    paddingHorizontal: 24,
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 12,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 4,
  },
  container: {
    flex: 1,
    backgroundColor: theme.appColors.background,
  },
  formCard: {
    margin: 16,
    backgroundColor: theme.appColors.surface,
    borderRadius: 16,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  formSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.appColors.background,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.appColors.text,
  },
  label: {
    fontSize: 13,
    color: theme.appColors.text,
    marginBottom: 6,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
    backgroundColor: theme.appColors.background,
    fontSize: 15,
    color: theme.appColors.text,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  actionBar: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: theme.appColors.surface,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  saveButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 4,
  },
  sendButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 4,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  complaintCard: {
    backgroundColor: theme.appColors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  complaintCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  complaintCardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.appColors.text,
    flex: 1,
  },
  complaintCardInfo: {
    gap: 8,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    color: theme.appColors.subtext,
  },
  complaintCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.appColors.background,
  },
  viewDetailsText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.appColors.primary,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: theme.appColors.subtext,
    marginTop: 16,
  },
});
