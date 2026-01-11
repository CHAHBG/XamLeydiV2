/**
 * XamLeydi v2.0 - À propos
 * Modern about screen using the v2 design system.
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Constants from 'expo-constants';

import { SafeIonicons } from '../../components/SafeIcons';
import { useDesignTheme } from '../../ui/ThemeContext';
import { Card, Button, Divider, InfoRow } from '../../ui/components/ModernComponents';
import { spacing, radii } from '../../ui/designSystem';

const PHONE_DISPLAY = '+221 77 65853 71';
const PHONE_RAW = '+221776585371';
const EMAIL = 'cheikhabgn@gmail.com';
const LINKEDIN_URL = 'https://www.linkedin.com/in/khadimgn';

function getAppVersion(): string {
  const anyConstants: any = Constants as any;
  return (
    anyConstants?.expoConfig?.version ||
    anyConstants?.manifest2?.extra?.expoClient?.version ||
    anyConstants?.manifest?.version ||
    '—'
  );
}

export default function AproposScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useDesignTheme();

  const styles = useMemo(() => createStyles(theme, insets.top), [theme, insets.top]);

  const openUrl = async (url: string, errorMessage: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert(errorMessage);
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert(errorMessage);
    }
  };

  const openMail = () => {
    const subject = encodeURIComponent('Contact via XamLeydi');
    openUrl(`mailto:${EMAIL}?subject=${subject}`, "Impossible d'ouvrir le client mail");
  };

  const openCall = () => {
    openUrl(`tel:${PHONE_RAW}`, "Impossible de passer un appel");
  };

  const openWhatsApp = async () => {
    const digits = PHONE_RAW.replace(/[^0-9+]/g, '');
    const appUrl = `whatsapp://send?phone=${digits}`;
    const webUrl = `https://wa.me/${digits.replace(/^\+/, '')}`;

    try {
      const supported = await Linking.canOpenURL(appUrl);
      await Linking.openURL(supported ? appUrl : webUrl);
    } catch {
      Alert.alert("Impossible d'ouvrir WhatsApp");
    }
  };

  const openLinkedIn = () => {
    openUrl(LINKEDIN_URL, "Impossible d'ouvrir LinkedIn");
  };

  const version = getAppVersion();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.colors.background}
      />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => (navigation as any).goBack?.()}
          style={styles.headerIcon}
        >
          <SafeIonicons name="arrow-back" size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>À propos</Text>
        <View style={styles.headerRightSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Card theme={theme} style={styles.card}>
          <Text style={styles.cardTitle}>Application</Text>
          <Text style={styles.paragraph}>
            Cette application aide à rechercher et gérer des parcelles, visualiser la géométrie et enregistrer des plaintes liées aux parcelles.
          </Text>

          <Divider theme={theme} />

          <View style={styles.featureRow}>
            <SafeIonicons name="search" size={18} color={theme.colors.primary} />
            <Text style={styles.featureText}>Recherche avancée de parcelles</Text>
          </View>
          <View style={styles.featureRow}>
            <SafeIonicons name="qr-code" size={18} color={theme.colors.primary} />
            <Text style={styles.featureText}>Scanner QR pour accès rapide</Text>
          </View>
          <View style={styles.featureRow}>
            <SafeIonicons name="map" size={18} color={theme.colors.primary} />
            <Text style={styles.featureText}>Visualisation cartographique</Text>
          </View>
          <View style={styles.featureRow}>
            <SafeIonicons name="document-text" size={18} color={theme.colors.primary} />
            <Text style={styles.featureText}>Gestion des plaintes</Text>
          </View>
        </Card>

        <Card theme={theme} style={styles.card}>
          <Text style={styles.cardTitle}>Développé par</Text>
          <Text style={styles.developerName}>Cheikh Ahmadou Bamba GNINGUE</Text>
          <Text style={styles.developerRole}>Géomaticien & Développeur</Text>

          <Divider theme={theme} />

          <InfoRow
            icon="mail"
            label="Email"
            value={EMAIL}
            onPress={openMail}
            theme={theme}
          />
          <InfoRow
            icon="call"
            label="Téléphone"
            value={PHONE_DISPLAY}
            onPress={openCall}
            theme={theme}
          />
          <InfoRow
            icon="logo-whatsapp"
            label="WhatsApp"
            value={PHONE_DISPLAY}
            onPress={openWhatsApp}
            theme={theme}
          />
          <InfoRow
            icon="logo-linkedin"
            label="LinkedIn"
            value="linkedin.com/in/khadimgn"
            onPress={openLinkedIn}
            theme={theme}
          />

          <View style={styles.actionsRow}>
            <Button
              title="Email"
              icon="mail"
              variant="primary"
              onPress={openMail}
              theme={theme}
              style={styles.actionBtn}
            />
            <Button
              title="Appeler"
              icon="call"
              variant="outline"
              onPress={openCall}
              theme={theme}
              style={styles.actionBtn}
            />
          </View>
        </Card>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Version {version}</Text>
          <Text style={styles.footerText}>© 2026 Tous droits réservés</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(theme: any, safeTop: number) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingTop: safeTop > 0 ? spacing.md : spacing.lg,
      paddingBottom: spacing.md,
      backgroundColor: theme.colors.background,
    },
    headerIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.backgroundAlt,
    },
    headerTitle: {
      fontSize: theme.typography.fontSize.h3,
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.text,
    },
    headerRightSpacer: {
      width: 40,
      height: 40,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xl,
    },
    card: {
      marginBottom: spacing.lg,
      padding: spacing.lg,
    },
    cardTitle: {
      fontSize: theme.typography.fontSize.h4,
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.text,
      marginBottom: spacing.sm,
    },
    paragraph: {
      fontSize: theme.typography.fontSize.body,
      color: theme.colors.textSecondary,
      lineHeight: 22,
      marginBottom: spacing.md,
    },
    featureRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.sm,
    },
    featureText: {
      flex: 1,
      fontSize: theme.typography.fontSize.body,
      color: theme.colors.text,
    },
    developerName: {
      fontSize: theme.typography.fontSize.body,
      fontWeight: theme.typography.fontWeight.semiBold,
      color: theme.colors.text,
      marginTop: spacing.xs,
    },
    developerRole: {
      fontSize: theme.typography.fontSize.small,
      color: theme.colors.textTertiary,
      marginTop: 2,
      marginBottom: spacing.sm,
    },
    actionsRow: {
      flexDirection: 'row',
      gap: spacing.md,
      marginTop: spacing.md,
    },
    actionBtn: {
      flex: 1,
      borderRadius: radii.sm,
    },
    footer: {
      alignItems: 'center',
      paddingVertical: spacing.lg,
    },
    footerText: {
      fontSize: theme.typography.fontSize.small,
      color: theme.colors.textTertiary,
      marginTop: 2,
    },
  });
}
