import React from 'react';
import { View, Text, StyleSheet, ScrollView, Linking, Platform, Alert, TouchableOpacity, SafeAreaView, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeMaterialCommunityIcons } from '../components/SafeIcons';
import theme from '../theme';

const AproposScreen = () => {
  const windowDimensions = useWindowDimensions();
  
  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Gradient Header */}
      <LinearGradient
        colors={['#A02020', '#D32F2F', '#E53935']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientHeader}
      >
        <SafeMaterialCommunityIcons name="information" size={64} color="#FFFFFF" style={{ opacity: 0.9 }} />
        <Text style={styles.headerTitle}>À propos</Text>
        <Text style={styles.headerSubtitle}>ParcelApp - Gestion de parcelles</Text>
      </LinearGradient>

      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {/* App Info Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <SafeMaterialCommunityIcons name="apps" size={28} color={theme.appColors.primary} />
            <Text style={styles.cardTitle}>Application</Text>
          </View>
          <Text style={styles.paragraph}>Cette application aide à rechercher et gérer des parcelles, visualiser la géométrie et enregistrer des plaintes liées aux parcelles.</Text>
          <View style={styles.featureList}>
            <View style={styles.featureItem}>
              <SafeMaterialCommunityIcons name="map-search" size={20} color={theme.appColors.primary} />
              <Text style={styles.featureText}>Recherche avancée de parcelles</Text>
            </View>
            <View style={styles.featureItem}>
              <SafeMaterialCommunityIcons name="qrcode-scan" size={20} color={theme.appColors.primary} />
              <Text style={styles.featureText}>Scanner QR pour accès rapide</Text>
            </View>
            <View style={styles.featureItem}>
              <SafeMaterialCommunityIcons name="map-marker" size={20} color={theme.appColors.primary} />
              <Text style={styles.featureText}>Visualisation cartographique</Text>
            </View>
            <View style={styles.featureItem}>
              <SafeMaterialCommunityIcons name="file-document-edit" size={20} color={theme.appColors.primary} />
              <Text style={styles.featureText}>Gestion des plaintes</Text>
            </View>
          </View>
        </View>

        {/* Developer Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <SafeMaterialCommunityIcons name="account-circle" size={28} color={theme.appColors.primary} />
            <Text style={styles.cardTitle}>Développé par</Text>
          </View>
          
          <View style={styles.developerInfo}>
            <View style={styles.avatarContainer}>
              <LinearGradient
                colors={['#A02020', '#D32F2F']}
                style={styles.avatar}
              >
                <Text style={styles.avatarText}>CG</Text>
              </LinearGradient>
            </View>
            <View style={styles.developerDetails}>
              <Text style={styles.developerName}>Cheikh Ahmadou Bamba GNINGUE</Text>
              <Text style={styles.developerRole}>Géomaticien & Développeur</Text>
            </View>
          </View>

          <View style={styles.contactSection}>
            <View style={styles.contactItem}>
              <SafeMaterialCommunityIcons name="email" size={18} color={theme.appColors.primary} />
              <Text style={styles.contactText}>cheikhabgn@gmail.com</Text>
            </View>
            <View style={styles.contactItem}>
              <SafeMaterialCommunityIcons name="phone" size={18} color={theme.appColors.primary} />
              <Text style={styles.contactText}>+221 77 65853 71</Text>
            </View>
            <View style={styles.contactItem}>
              <SafeMaterialCommunityIcons name="linkedin" size={18} color={theme.appColors.primary} />
              <Text style={styles.contactText}>linkedin.com/in/khadimgn</Text>
            </View>
          </View>

          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                const email = 'cheikhabgn@gmail.com';
                const subject = encodeURIComponent('Contact via ParcelApp');
                const url = `mailto:${email}?subject=${subject}`;
                Linking.openURL(url).catch(() => Alert.alert('Impossible d\'ouvrir le client mail'));
              }}
            >
              <LinearGradient
                colors={['#D32F2F', '#E53935']}
                style={styles.actionButtonGradient}
              >
                <SafeMaterialCommunityIcons name="email" size={22} color="#FFFFFF" />
                <Text style={styles.actionButtonText}>Email</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                const raw = '+221776585371';
                const phone = raw.replace(/[^0-9+]/g, '');
                const appUrl = `whatsapp://send?phone=${phone}`;
                const webUrl = `https://wa.me/${phone.replace(/^\+/, '')}`;
                Linking.canOpenURL(appUrl)
                  .then((supported) => (supported ? Linking.openURL(appUrl) : Linking.openURL(webUrl)))
                  .catch(() => Alert.alert('Impossible d\'ouvrir WhatsApp'));
              }}
            >
              <LinearGradient
                colors={['#25D366', '#128C7E']}
                style={styles.actionButtonGradient}
              >
                <SafeMaterialCommunityIcons name="whatsapp" size={22} color="#FFFFFF" />
                <Text style={styles.actionButtonText}>WhatsApp</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                const tel = 'tel:+221776585371';
                Linking.openURL(tel).catch(() => Alert.alert('Impossible de passer un appel'));
              }}
            >
              <LinearGradient
                colors={['#4CAF50', '#66BB6A']}
                style={styles.actionButtonGradient}
              >
                <SafeMaterialCommunityIcons name="phone" size={22} color="#FFFFFF" />
                <Text style={styles.actionButtonText}>Appeler</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                const profile = 'khadimgn';
                const appUrl = `linkedin://in/${profile}`;
                const webUrl = `https://www.linkedin.com/in/${profile}`;
                Linking.canOpenURL(appUrl)
                  .then((supported) => (supported ? Linking.openURL(appUrl) : Linking.openURL(webUrl)))
                  .catch(() => Linking.openURL(webUrl).catch(() => Alert.alert('Impossible d\'ouvrir LinkedIn')));
              }}
            >
              <LinearGradient
                colors={['#0077B5', '#0A66C2']}
                style={styles.actionButtonGradient}
              >
                <SafeMaterialCommunityIcons name="linkedin" size={22} color="#FFFFFF" />
                <Text style={styles.actionButtonText}>LinkedIn</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* Version Info */}
        <View style={styles.versionCard}>
          <Text style={styles.versionText}>Version 1.0.0</Text>
          <Text style={styles.copyrightText}>© 2025 Tous droits réservés</Text>
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
  gradientHeader: {
    paddingTop: 20,
    paddingBottom: 30,
    paddingHorizontal: 24,
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 12,
  },
  headerSubtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 4,
  },
  container: {
    flex: 1,
    backgroundColor: theme.appColors.background,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: theme.appColors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.appColors.text,
  },
  paragraph: {
    fontSize: 15,
    color: theme.appColors.subtext,
    lineHeight: 22,
    marginBottom: 12,
  },
  featureList: {
    marginTop: 12,
    gap: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    fontSize: 14,
    color: theme.appColors.text,
    flex: 1,
  },
  developerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 16,
  },
  avatarContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  avatar: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  developerDetails: {
    flex: 1,
  },
  developerName: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.appColors.text,
    marginBottom: 4,
  },
  developerRole: {
    fontSize: 14,
    color: theme.appColors.subtext,
  },
  contactSection: {
    backgroundColor: theme.appColors.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  contactText: {
    fontSize: 14,
    color: theme.appColors.text,
  },
  actionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    minWidth: '45%',
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  actionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 8,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  versionCard: {
    backgroundColor: 'transparent',
    alignItems: 'center',
    paddingVertical: 16,
  },
  versionText: {
    fontSize: 13,
    color: theme.appColors.subtext,
    fontWeight: '600',
    marginBottom: 4,
  },
  copyrightText: {
    fontSize: 12,
    color: theme.appColors.subtext,
  },
});

export default AproposScreen;
