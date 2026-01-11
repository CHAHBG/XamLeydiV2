/**
 * XamLeydi v2.0 - Modern UI Components
 * Clean, reusable components following Material Design 3 / iOS HIG
 */

import React, { ReactNode } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { SafeIonicons } from '../../components/SafeIcons';
import { DesignTheme, spacing, radii, layout, shadows } from '../designSystem';

// =============================================================================
// BUTTON COMPONENT
// =============================================================================

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
export type ButtonSize = 'small' | 'medium' | 'large';

interface ButtonProps {
  label?: string;
  title?: string; // Alias for label
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: string;
  iconPosition?: 'left' | 'right';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  theme: DesignTheme;
}

export const Button: React.FC<ButtonProps> = ({
  label,
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  icon,
  iconPosition = 'left',
  disabled = false,
  loading = false,
  fullWidth = false,
  style,
  theme,
}) => {
  const buttonLabel = label || title || '';
  
  const getButtonStyles = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radii.sm,
      minHeight: layout.minTouchTarget,
    };

    // Size styles
    const sizeStyles: Record<ButtonSize, ViewStyle> = {
      small: { paddingHorizontal: 16, paddingVertical: 8, minHeight: 36 },
      medium: { paddingHorizontal: 24, paddingVertical: 12, minHeight: 48 },
      large: { paddingHorizontal: 32, paddingVertical: 16, minHeight: 56 },
    };

    // Variant styles
    const variantStyles: Record<ButtonVariant, ViewStyle> = {
      primary: {
        backgroundColor: disabled ? theme.colors.disabled : theme.colors.primary,
      },
      secondary: {
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderColor: disabled ? theme.colors.disabled : theme.colors.primary,
      },
      outline: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: disabled ? theme.colors.disabled : theme.colors.border,
      },
      ghost: {
        backgroundColor: 'transparent',
      },
      danger: {
        backgroundColor: disabled ? theme.colors.disabled : theme.colors.danger,
      },
    };

    return {
      ...baseStyle,
      ...sizeStyles[size],
      ...variantStyles[variant],
      ...(fullWidth && { width: '100%' }),
    };
  };

  const getTextColor = (): string => {
    if (disabled) return theme.colors.textTertiary;
    switch (variant) {
      case 'primary':
      case 'danger':
        return '#FFFFFF';
      case 'secondary':
      case 'ghost':
        return theme.colors.primary;
      case 'outline':
        return theme.colors.text;
      default:
        return theme.colors.text;
    }
  };

  const textColor = getTextColor();
  const iconSize = size === 'small' ? 16 : size === 'large' ? 22 : 18;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      style={[getButtonStyles(), style]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <>
          {icon && iconPosition === 'left' && (
            <SafeIonicons
              name={icon as any}
              size={iconSize}
              color={textColor}
              style={{ marginRight: 8 }}
            />
          )}
          <Text
            style={{
              color: textColor,
              fontSize: theme.typography.fontSize.button,
              fontWeight: theme.typography.fontWeight.semiBold,
            }}
          >
            {buttonLabel}
          </Text>
          {icon && iconPosition === 'right' && (
            <SafeIonicons
              name={icon as any}
              size={iconSize}
              color={textColor}
              style={{ marginLeft: 8 }}
            />
          )}
        </>
      )}
    </TouchableOpacity>
  );
};

// =============================================================================
// CARD COMPONENT
// =============================================================================

interface CardProps {
  children: ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  elevated?: boolean;
  theme: DesignTheme;
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  onPress,
  elevated = false,
  theme,
}) => {
  const cardStyle: ViewStyle = {
    backgroundColor: theme.colors.surface,
    borderRadius: radii.md,
    padding: layout.cardPadding,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...(elevated ? shadows.md : shadows.sm),
  };

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          cardStyle,
          pressed && { backgroundColor: theme.colors.backgroundAlt },
          style,
        ]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={[cardStyle, style]}>{children}</View>;
};

// =============================================================================
// BADGE COMPONENT
// =============================================================================

export type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  icon?: string;
  size?: 'small' | 'medium';
  theme: DesignTheme;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'default',
  icon,
  size = 'small',
  theme,
}) => {
  const getBadgeColors = () => {
    switch (variant) {
      case 'primary':
        return { bg: theme.colors.primary + '20', text: theme.colors.primary };
      case 'success':
        return { bg: theme.colors.successBg, text: theme.colors.statusValidated };
      case 'warning':
        return { bg: theme.colors.warningBg, text: theme.colors.statusPending };
      case 'danger':
        return { bg: theme.colors.dangerBg, text: theme.colors.statusRejected };
      case 'info':
        return { bg: theme.colors.infoBg, text: theme.colors.info };
      default:
        return { bg: theme.colors.backgroundAlt, text: theme.colors.textSecondary };
    }
  };

  const colors = getBadgeColors();
  const isSmall = size === 'small';

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.bg,
        paddingHorizontal: isSmall ? 8 : 12,
        paddingVertical: isSmall ? 2 : 4,
        borderRadius: radii.full,
      }}
    >
      {icon && (
        <SafeIonicons
          name={icon as any}
          size={isSmall ? 12 : 14}
          color={colors.text}
          style={{ marginRight: 4 }}
        />
      )}
      <Text
        style={{
          color: colors.text,
          fontSize: isSmall ? 11 : 12,
          fontWeight: theme.typography.fontWeight.semiBold,
        }}
      >
        {label}
      </Text>
    </View>
  );
};

// =============================================================================
// INPUT COMPONENT
// =============================================================================

interface InputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  label?: string;
  icon?: string;
  error?: string;
  disabled?: boolean;
  multiline?: boolean;
  numberOfLines?: number;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  style?: ViewStyle;
  theme: DesignTheme;
  onClear?: () => void;
}

export const Input: React.FC<InputProps> = ({
  value,
  onChangeText,
  placeholder,
  label,
  icon,
  error,
  disabled = false,
  multiline = false,
  numberOfLines = 1,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  style,
  theme,
  onClear,
}) => {
  const hasError = !!error;
  const borderColor = hasError
    ? theme.colors.danger
    : disabled
    ? theme.colors.disabled
    : theme.colors.border;

  return (
    <View style={[{ marginBottom: spacing.md }, style]}>
      {label && (
        <Text
          style={{
            fontSize: theme.typography.fontSize.small,
            fontWeight: theme.typography.fontWeight.semiBold,
            color: theme.colors.text,
            marginBottom: spacing.xs,
          }}
        >
          {label}
        </Text>
      )}
      <View
        style={{
          flexDirection: 'row',
          alignItems: multiline ? 'flex-start' : 'center',
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor,
          borderRadius: radii.sm,
          minHeight: multiline ? 100 : layout.inputHeight,
          paddingHorizontal: spacing.md,
        }}
      >
        {icon && (
          <SafeIonicons
            name={icon as any}
            size={20}
            color={theme.colors.textTertiary}
            style={{ marginRight: spacing.sm }}
          />
        )}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textTertiary}
          editable={!disabled}
          multiline={multiline}
          numberOfLines={numberOfLines}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          style={{
            flex: 1,
            color: theme.colors.text,
            fontSize: theme.typography.fontSize.body,
            paddingVertical: multiline ? spacing.md : 0,
            textAlignVertical: multiline ? 'top' : 'center',
          }}
        />
        {value.length > 0 && onClear && (
          <TouchableOpacity onPress={onClear}>
            <SafeIonicons
              name="close-circle"
              size={20}
              color={theme.colors.textTertiary}
            />
          </TouchableOpacity>
        )}
      </View>
      {hasError && (
        <Text
          style={{
            fontSize: theme.typography.fontSize.small,
            color: theme.colors.danger,
            marginTop: spacing.xs,
          }}
        >
          {error}
        </Text>
      )}
    </View>
  );
};

// =============================================================================
// SEARCH BAR COMPONENT
// =============================================================================

export interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onClear?: () => void;
  onFilterPress?: () => void;
  onSubmit?: () => void;
  theme: DesignTheme;
  style?: ViewStyle;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChangeText,
  placeholder = 'Rechercher...',
  onClear,
  onFilterPress,
  onSubmit,
  theme,
  style,
}) => {
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: theme.colors.surface,
          borderRadius: radii.md,
          paddingHorizontal: spacing.md,
          height: layout.inputHeight,
          ...shadows.sm,
        },
        style,
      ]}
    >
      <SafeIonicons
        name="search"
        size={20}
        color={theme.colors.textTertiary}
        style={{ marginRight: spacing.sm }}
      />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textTertiary}
        returnKeyType="search"
        onSubmitEditing={onSubmit}
        style={{
          flex: 1,
          color: theme.colors.text,
          fontSize: theme.typography.fontSize.body,
        }}
      />
      {value.length > 0 && (
        <TouchableOpacity onPress={onClear} style={{ marginRight: spacing.sm }}>
          <SafeIonicons name="close-circle" size={20} color={theme.colors.textTertiary} />
        </TouchableOpacity>
      )}
      {onFilterPress && (
        <TouchableOpacity onPress={onFilterPress}>
          <SafeIonicons name="options" size={20} color={theme.colors.primary} />
        </TouchableOpacity>
      )}
    </View>
  );
};

// =============================================================================
// QUICK ACTION BUTTON
// =============================================================================

interface QuickActionButtonProps {
  icon: string;
  label: string;
  onPress: () => void;
  theme: DesignTheme;
  variant?: 'primary' | 'secondary';
}

export const QuickActionButton: React.FC<QuickActionButtonProps> = ({
  icon,
  label,
  onPress,
  theme,
  variant = 'primary',
}) => {
  const isPrimary = variant === 'primary';
  
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{ alignItems: 'center', width: 80 }}
    >
      <View
        style={{
          width: layout.quickActionSize,
          height: layout.quickActionSize,
          borderRadius: layout.quickActionRadius,
          backgroundColor: isPrimary ? theme.colors.primary : theme.colors.surface,
          borderWidth: isPrimary ? 0 : 1,
          borderColor: theme.colors.border,
          alignItems: 'center',
          justifyContent: 'center',
          ...shadows.md,
        }}
      >
        <SafeIonicons
          name={icon as any}
          size={24}
          color={isPrimary ? '#FFFFFF' : theme.colors.primary}
        />
      </View>
      <Text
        style={{
          marginTop: spacing.sm,
          fontSize: theme.typography.fontSize.small,
          fontWeight: theme.typography.fontWeight.medium,
          color: theme.colors.text,
          textAlign: 'center',
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
};

// =============================================================================
// SECTION HEADER
// =============================================================================

interface SectionHeaderProps {
  title: string;
  action?: { label: string; onPress: () => void };
  theme: DesignTheme;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  action,
  theme,
}) => {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.md,
      }}
    >
      <Text
        style={{
          fontSize: theme.typography.fontSize.h3,
          fontWeight: theme.typography.fontWeight.semiBold,
          color: theme.colors.text,
        }}
      >
        {title}
      </Text>
      {action && (
        <TouchableOpacity onPress={action.onPress}>
          <Text
            style={{
              fontSize: theme.typography.fontSize.body,
              fontWeight: theme.typography.fontWeight.medium,
              color: theme.colors.primary,
            }}
          >
            {action.label}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// =============================================================================
// DIVIDER
// =============================================================================

interface DividerProps {
  theme: DesignTheme;
  style?: ViewStyle;
}

export const Divider: React.FC<DividerProps> = ({ theme, style }) => {
  return (
    <View
      style={[
        {
          height: 1,
          backgroundColor: theme.colors.divider,
          marginVertical: spacing.md,
        },
        style,
      ]}
    />
  );
};

// =============================================================================
// EMPTY STATE
// =============================================================================

export interface EmptyStateProps {
  icon: string;
  title: string;
  subtitle?: string;
  description?: string; // Alias for subtitle
  action?: { label: string; onPress: () => void };
  theme: DesignTheme;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  subtitle,
  description,
  action,
  theme,
}) => {
  const displayText = subtitle || description;
  
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['2xl'] }}>
      <View
        style={{
          width: 80,
          height: 80,
          borderRadius: 40,
          backgroundColor: theme.colors.backgroundAlt,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing.lg,
        }}
      >
        <SafeIonicons name={icon as any} size={40} color={theme.colors.textTertiary} />
      </View>
      <Text
        style={{
          fontSize: theme.typography.fontSize.h3,
          fontWeight: theme.typography.fontWeight.semiBold,
          color: theme.colors.text,
          textAlign: 'center',
          marginBottom: spacing.sm,
        }}
      >
        {title}
      </Text>
      {displayText && (
        <Text
          style={{
            fontSize: theme.typography.fontSize.body,
            color: theme.colors.textSecondary,
            textAlign: 'center',
            marginBottom: spacing.lg,
          }}
        >
          {displayText}
        </Text>
      )}
      {action && (
        <Button
          label={action.label}
          onPress={action.onPress}
          variant="primary"
          theme={theme}
        />
      )}
    </View>
  );
};

// =============================================================================
// PROGRESS INDICATOR
// =============================================================================

interface ProgressIndicatorProps {
  currentStep: number;
  totalSteps: number;
  theme: DesignTheme;
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  currentStep,
  totalSteps,
  theme,
}) => {
  const progress = (currentStep / totalSteps) * 100;

  return (
    <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
        <Text
          style={{
            fontSize: theme.typography.fontSize.small,
            fontWeight: theme.typography.fontWeight.medium,
            color: theme.colors.textSecondary,
          }}
        >
          Étape {currentStep}/{totalSteps}
        </Text>
        <Text
          style={{
            fontSize: theme.typography.fontSize.small,
            fontWeight: theme.typography.fontWeight.medium,
            color: theme.colors.primary,
          }}
        >
          {Math.round(progress)}%
        </Text>
      </View>
      <View
        style={{
          height: 4,
          backgroundColor: theme.colors.backgroundAlt,
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${progress}%`,
            height: '100%',
            backgroundColor: theme.colors.primary,
            borderRadius: 2,
          }}
        />
      </View>
    </View>
  );
};

// =============================================================================
// INFO ROW
// =============================================================================

interface InfoRowProps {
  icon: string;
  label: string;
  value: string;
  theme: DesignTheme;
  onPress?: () => void;
}

export const InfoRow: React.FC<InfoRowProps> = ({
  icon,
  label,
  value,
  theme,
  onPress,
}) => {
  const content = (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm }}>
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: theme.colors.backgroundAlt,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: spacing.md,
        }}
      >
        <SafeIonicons name={icon as any} size={18} color={theme.colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: theme.typography.fontSize.small,
            color: theme.colors.textTertiary,
          }}
        >
          {label}
        </Text>
        <Text
          style={{
            fontSize: theme.typography.fontSize.body,
            fontWeight: theme.typography.fontWeight.medium,
            color: theme.colors.text,
          }}
          numberOfLines={2}
        >
          {value}
        </Text>
      </View>
      {onPress && (
        <SafeIonicons name="chevron-forward" size={20} color={theme.colors.textTertiary} />
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

// =============================================================================
// SKELETON LOADER
// =============================================================================

interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  theme: DesignTheme;
  style?: ViewStyle;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%' as const,
  height = 16,
  borderRadius = radii.sm,
  theme,
  style,
}) => {
  return (
    <View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: theme.colors.backgroundAlt,
        },
        style,
      ]}
    />
  );
};

// =============================================================================
// TAB BAR ITEM
// =============================================================================

interface TabBarItemProps {
  icon: string;
  label: string;
  isActive: boolean;
  onPress: () => void;
  theme: DesignTheme;
}

export const TabBarItem: React.FC<TabBarItemProps> = ({
  icon,
  label,
  isActive,
  onPress,
  theme,
}) => {
  const color = isActive ? theme.colors.tabBarActive : theme.colors.tabBarInactive;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.sm,
      }}
    >
      <SafeIonicons name={icon as any} size={24} color={color} />
      <Text
        style={{
          fontSize: theme.typography.fontSize.tiny,
          fontWeight: isActive
            ? theme.typography.fontWeight.semiBold
            : theme.typography.fontWeight.regular,
          color,
          marginTop: 2,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
};

export default {
  Button,
  Card,
  Badge,
  Input,
  SearchBar,
  QuickActionButton,
  SectionHeader,
  Divider,
  EmptyState,
  ProgressIndicator,
  InfoRow,
  Skeleton,
  TabBarItem,
};
