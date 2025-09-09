import React from 'react';
import { View, Text, StyleSheet, ScrollView, Linking, Platform, Alert, TouchableOpacity, SafeAreaView, useWindowDimensions } from 'react-native';

import { SafeMaterialCommunityIcons } from '../components/SafeIcons';
import theme from '../theme';

const AproposScreen = () => {
  const windowDimensions = useWindowDimensions();
  
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={[styles.container, { backgroundColor: theme.appColors.background }]} contentContainerStyle={{ padding: 20 }}>
        <View style={[styles.card, { borderRadius: 16, elevation: 4, shadowColor: theme.appColors.cardShadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 8 }]}> 
        <View style={{ padding: 22 }}>
          <Text style={[styles.title, { color: theme.appColors.text }]}>A propos</Text>
          <Text style={[styles.paragraph, { color: theme.appColors.subtext }]}>Cette application aide à rechercher et gérer des parcelles, visualiser la géométrie et enregistrer des plaintes liées aux parcelles.</Text>

          <Text style={[styles.sectionTitle, { marginTop: 18, color: theme.appColors.text }]}>Développé par</Text>
          <Text style={[styles.paragraph, { color: theme.appColors.text, fontWeight: '700' }]}>Cheikh Ahmadou Bamba GNINGUE</Text>
          <Text style={[styles.paragraph, { color: theme.appColors.subtext }]}>cheikhabgn@gmail.com</Text>
          <Text style={[styles.paragraph, { color: theme.appColors.subtext }]}>+221 77 802 38 51</Text>
          <Text style={[styles.paragraph, { color: theme.appColors.subtext }]}>Géomaticien, développeur</Text>

          <View style={styles.iconRow}>
            {/* Email */}
            <TouchableOpacity
              onPress={() => {
                const email = 'cheikhabgn@gmail.com';
                const subject = encodeURIComponent('Contact via ParcelApp');
                const url = `mailto:${email}?subject=${subject}`;
                Linking.openURL(url).catch(() => Alert.alert('Impossible d\'ouvrir le client mail'));
              }}
              accessibilityLabel="Envoyer un email"
              style={{ marginRight: 8 }}
            >
              <SafeMaterialCommunityIcons name="email" size={28} color={theme.appColors.primary} />
            </TouchableOpacity>

            {/* WhatsApp */}
            <TouchableOpacity
              onPress={() => {
                const raw = '+221778023851';
                const phone = raw.replace(/[^0-9+]/g, '');
                const appUrl = `whatsapp://send?phone=${phone}`;
                const webUrl = `https://wa.me/${phone.replace(/^\+/, '')}`;
                Linking.canOpenURL(appUrl)
                  .then((supported) => (supported ? Linking.openURL(appUrl) : Linking.openURL(webUrl)))
                  .catch(() => Alert.alert('Impossible d\'ouvrir WhatsApp'));
              }}
              accessibilityLabel="Envoyer un message WhatsApp"
              style={{ marginRight: 8 }}
            >
              <SafeMaterialCommunityIcons name="whatsapp" size={28} color={theme.appColors.secondary} />
            </TouchableOpacity>

            {/* Call */}
            <TouchableOpacity
              onPress={() => {
                const tel = 'tel:+221778023851';
                Linking.openURL(tel).catch(() => Alert.alert('Impossible de passer un appel'));
              }}
              accessibilityLabel="Appeler"
              style={{ marginRight: 8 }}
            >
              <SafeMaterialCommunityIcons name="phone" size={28} color={theme.appColors.accent || theme.appColors.primary} />
            </TouchableOpacity>

            {/* LinkedIn */}
            <TouchableOpacity
              onPress={() => {
                const profile = 'khadimgn';
                const appUrl = `linkedin://in/${profile}`;
                const webUrl = `https://www.linkedin.com/in/${profile}`;
                Linking.canOpenURL(appUrl)
                  .then((supported) => (supported ? Linking.openURL(appUrl) : Linking.openURL(webUrl)))
                  .catch(() => Linking.openURL(webUrl).catch(() => Alert.alert('Impossible d\'ouvrir LinkedIn')));
              }}
              accessibilityLabel="Voir le profil LinkedIn"
            >
              <SafeMaterialCommunityIcons name="linkedin" size={28} color={theme.appColors.secondary || theme.appColors.primary} />
            </TouchableOpacity>
          </View>

          <Text
            style={[styles.paragraph, { color: theme.appColors.subtext, marginTop: 8, textDecorationLine: 'underline' }]}
            onPress={() => {
              const webUrl = 'https://www.linkedin.com/in/khadimgn';
              Linking.openURL(webUrl).catch(() => Alert.alert('Impossible d\'ouvrir LinkedIn'));
            }}
          >
            LinkedIn: www.linkedin.com/in/khadimgn
          </Text>
        </View>
      </View>
    </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.appColors.background,
  },
  container: { flex: 1, backgroundColor: theme.appColors.background },
  card: {
    backgroundColor: theme.appColors.surface,
    borderRadius: 16,
    shadowColor: theme.appColors.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 18,
  },
  title: { fontSize: 24, fontWeight: '800', color: theme.appColors.text, marginBottom: 8 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: theme.appColors.text },
  paragraph: { fontSize: 16, color: theme.appColors.subtext, lineHeight: 23 },
  iconRow: { flexDirection: 'row', alignItems: 'center', marginTop: 18, marginBottom: 2, gap: 16 },
});

export default AproposScreen;
