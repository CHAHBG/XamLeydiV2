import React, { useMemo } from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View, ViewStyle, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeIonicons } from '../../components/SafeIcons';
import { useAppTheme } from '../ThemeProvider';
import type { Theme } from '../theme';

interface EnhancedButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'outline' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  loading?: boolean;
  disabled?: boolean;
  icon?: string;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  style?: ViewStyle;
}

export const EnhancedButton: React.FC<EnhancedButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  loading = false,
  disabled = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  style,
}) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const isDisabled = disabled || loading;

  const getGradientColors = (): [string, string, ...string[]] => {
    switch (variant) {
      case 'primary':
        return theme.colors.gradientPrimary as [string, string, ...string[]];
      case 'success':
        return theme.colors.gradientSuccess as [string, string, ...string[]];
      case 'danger':
        return [theme.colors.danger, theme.colors.dangerLight];
      default:
        return theme.colors.gradientPrimary as [string, string, ...string[]];
    }
  };

  const getBackgroundColor = () => {
    switch (variant) {
      case 'secondary':
        return theme.colors.backgroundDark;
      case 'outline':
      case 'ghost':
        return 'transparent';
      default:
        return theme.colors.primary;
    }
  };

  const getTextColor = () => {
    switch (variant) {
      case 'secondary':
        return theme.colors.text;
      case 'outline':
        return theme.colors.primary;
      case 'ghost':
        return theme.colors.textSecondary;
      default:
        return '#FFFFFF';
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return { paddingVertical: theme.spacing(1), paddingHorizontal: theme.spacing(2), fontSize: theme.typography.caption };
      case 'large':
        return { paddingVertical: theme.spacing(2), paddingHorizontal: theme.spacing(4), fontSize: theme.typography.h4 };
      default:
        return { paddingVertical: theme.spacing(1.5), paddingHorizontal: theme.spacing(3), fontSize: theme.typography.body };
    }
  };

  const sizeStyles = getSizeStyles();
  const useGradient = !isDisabled && (variant === 'primary' || variant === 'success' || variant === 'danger');

  const ButtonContent = () => (
    <View style={[
      styles.contentContainer,
      { opacity: isDisabled ? 0.5 : 1 },
    ]}>
      {loading ? (
        <ActivityIndicator size="small" color={getTextColor()} />
      ) : (
        <>
          {icon && iconPosition === 'left' && (
            <SafeIonicons name={icon as any} size={sizeStyles.fontSize} color={getTextColor()} style={styles.iconLeft} />
          )}
          <Text style={[
            styles.text,
            {
              color: getTextColor(),
              fontSize: sizeStyles.fontSize,
              fontWeight: variant === 'ghost' ? '500' : '600',
            },
          ]}>
            {title}
          </Text>
          {icon && iconPosition === 'right' && (
            <SafeIonicons name={icon as any} size={sizeStyles.fontSize} color={getTextColor()} style={styles.iconRight} />
          )}
        </>
      )}
    </View>
  );

  const containerStyle: StyleProp<ViewStyle> = [
    styles.button,
    {
      paddingVertical: sizeStyles.paddingVertical,
      paddingHorizontal: sizeStyles.paddingHorizontal,
      backgroundColor: useGradient ? 'transparent' : getBackgroundColor(),
      borderWidth: variant === 'outline' ? 2 : 0,
      borderColor: variant === 'outline' ? theme.colors.primary : 'transparent',
      width: fullWidth ? '100%' : 'auto',
    },
    !isDisabled && theme.shadows.md,
    style,
  ];

  if (useGradient) {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={isDisabled}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={getGradientColors()}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={containerStyle}
        >
          <ButtonContent />
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={containerStyle}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
    >
      <ButtonContent />
    </TouchableOpacity>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    button: {
      borderRadius: theme.radii.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    contentContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    text: {
      textAlign: 'center',
    },
    iconLeft: {
      marginRight: theme.spacing(1),
    },
    iconRight: {
      marginLeft: theme.spacing(1),
    },
  });
