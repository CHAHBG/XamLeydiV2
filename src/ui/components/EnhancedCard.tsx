import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ViewStyle, TouchableOpacity, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeIonicons } from '../../components/SafeIcons';
import { useAppTheme } from '../ThemeProvider';
import type { Theme } from '../theme';

interface EnhancedCardProps {
  children: React.ReactNode;
  variant?: 'elevated' | 'outlined' | 'gradient';
  onPress?: () => void;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  style?: ViewStyle;
  gradientColors?: [string, string, ...string[]];
}

export const EnhancedCard: React.FC<EnhancedCardProps> = ({
  children,
  variant = 'elevated',
  onPress,
  header,
  footer,
  style,
  gradientColors,
}) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const containerStyle = [
    styles.card,
    variant === 'outlined' && styles.outlined,
    variant === 'elevated' && theme.shadows.md,
    style,
  ];

  const CardContent = () => (
    <>
      {header && <View style={styles.header}>{header}</View>}
      <View style={styles.content}>{children}</View>
      {footer && <View style={styles.footer}>{footer}</View>}
    </>
  );

  if (variant === 'gradient' && gradientColors) {
    return (
      <TouchableOpacity
        disabled={!onPress}
        onPress={onPress}
        activeOpacity={0.9}
        style={[containerStyle, theme.shadows.lg]}
      >
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientContainer}
        >
          <CardContent />
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.9}
        style={containerStyle}
      >
        <CardContent />
      </TouchableOpacity>
    );
  }

  return (
    <View style={containerStyle}>
      <CardContent />
    </View>
  );
};

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: string;
  variant?: 'primary' | 'success' | 'warning' | 'info';
  subtitle?: string;
  onPress?: () => void;
  gradientColors?: [string, string, ...string[]];
  style?: StyleProp<ViewStyle>;
}

export const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  icon,
  variant = 'primary',
  subtitle,
  onPress,
  gradientColors,
  style,
}) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const getColors = (): { gradient: [string, string, ...string[]]; iconBg: string; icon: string } => {
    switch (variant) {
      case 'success':
        return {
          gradient: theme.colors.gradientSuccess as [string, string, ...string[]],
          iconBg: theme.colors.successLight,
          icon: theme.colors.success,
        };
      case 'warning':
        return {
          gradient: theme.colors.gradientWarning as [string, string, ...string[]],
          iconBg: theme.colors.warningLight,
          icon: theme.colors.warning,
        };
      case 'info':
        return {
          gradient: [theme.colors.accentLight, theme.colors.accent] as [string, string, ...string[]],
          iconBg: theme.colors.accentLight,
          icon: theme.colors.accent,
        };
      default:
        return {
          gradient: theme.colors.gradientPrimary as [string, string, ...string[]],
          iconBg: theme.colors.primaryLight,
          icon: theme.colors.primary,
        };
    }
  };

  const palette = getColors();
  const colors = {
    ...palette,
    gradient: gradientColors ?? palette.gradient,
  };

  return (
    <TouchableOpacity
      disabled={!onPress}
      onPress={onPress}
      activeOpacity={0.8}
      style={[styles.statsCard, theme.shadows.lg, style]}
    >
      <LinearGradient
        colors={colors.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.statsGradient}
      >
        <View style={styles.statsContent}>
          <View style={[styles.iconCircle, { backgroundColor: 'rgba(255, 255, 255, 0.25)' }]}>
            <SafeIonicons name={icon as any} size={28} color="#FFFFFF" />
          </View>
          
          <View style={styles.statsTextContainer}>
            <Text style={styles.statsTitle}>{title}</Text>
            <Text style={styles.statsValue}>{value}</Text>
            {subtitle && <Text style={styles.statsSubtitle}>{subtitle}</Text>}
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
};

interface BadgeProps {
  label: string;
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'neutral';
  size?: 'small' | 'medium';
  icon?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'primary',
  size = 'medium',
  icon,
}) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const getColors = () => {
    switch (variant) {
      case 'success':
        return { bg: theme.colors.successLight, text: theme.colors.success };
      case 'warning':
        return { bg: theme.colors.warningLight, text: theme.colors.warning };
      case 'danger':
        return { bg: theme.colors.dangerLight, text: theme.colors.danger };
      case 'neutral':
        return { bg: theme.colors.backgroundDark, text: theme.colors.textSecondary };
      default:
        return { bg: theme.colors.primaryLight, text: theme.colors.primary };
    }
  };

  const colors = getColors();
  const fontSize = size === 'small' ? theme.typography.tiny : theme.typography.caption;

  return (
    <View style={[styles.badge, { backgroundColor: colors.bg + '40' }]}>
      {icon && (
        <SafeIonicons name={icon as any} size={fontSize} color={colors.text} style={styles.badgeIcon} />
      )}
      <Text style={[styles.badgeText, { color: colors.text, fontSize }]}>
        {label}
      </Text>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radii.xl,
      overflow: 'hidden',
    },
    outlined: {
      borderWidth: 1.5,
      borderColor: theme.colors.border,
    },
    gradientContainer: {
      borderRadius: theme.radii.xl,
    },
    header: {
      paddingHorizontal: theme.spacing(2.5),
      paddingTop: theme.spacing(2.5),
      paddingBottom: theme.spacing(1.5),
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderLight,
    },
    content: {
      padding: theme.spacing(2.5),
    },
    footer: {
      paddingHorizontal: theme.spacing(2.5),
      paddingTop: theme.spacing(1.5),
      paddingBottom: theme.spacing(2.5),
      borderTopWidth: 1,
      borderTopColor: theme.colors.borderLight,
    },
    statsCard: {
      borderRadius: theme.radii['2xl'],
      overflow: 'hidden',
      marginBottom: theme.spacing(2),
    },
    statsGradient: {
      padding: theme.spacing(3),
    },
    statsContent: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    iconCircle: {
      width: 64,
      height: 64,
      borderRadius: theme.radii.full,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: theme.spacing(2.5),
    },
    statsTextContainer: {
      flex: 1,
    },
    statsTitle: {
      fontSize: theme.typography.caption,
      color: 'rgba(255, 255, 255, 0.9)',
      fontWeight: '500',
      marginBottom: theme.spacing(0.5),
    },
    statsValue: {
      fontSize: theme.typography.h1,
      color: '#FFFFFF',
      fontWeight: '800',
      letterSpacing: -0.5,
    },
    statsSubtitle: {
      fontSize: theme.typography.caption,
      color: 'rgba(255, 255, 255, 0.8)',
      marginTop: theme.spacing(0.5),
    },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing(1.5),
      paddingVertical: theme.spacing(0.5),
      borderRadius: theme.radii.full,
      alignSelf: 'flex-start',
    },
    badgeIcon: {
      marginRight: theme.spacing(0.5),
    },
    badgeText: {
      fontWeight: '600',
    },
  });
