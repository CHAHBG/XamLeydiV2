import React, { useMemo, useState } from 'react';
import { View, TextInput, Text, StyleSheet, Animated, ViewStyle, TextStyle } from 'react-native';
import { SafeIonicons } from '../../components/SafeIcons';
import { useAppTheme } from '../ThemeProvider';
import type { Theme } from '../theme';

interface EnhancedInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  icon?: string;
  secureTextEntry?: boolean;
  multiline?: boolean;
  numberOfLines?: number;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  error?: string;
  disabled?: boolean;
  style?: ViewStyle;
}

export const EnhancedInput: React.FC<EnhancedInputProps> = ({
  label,
  value,
  onChangeText,
  placeholder,
  icon,
  secureTextEntry,
  multiline,
  numberOfLines = 1,
  keyboardType = 'default',
  error,
  disabled,
  style,
}) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [isFocused, setIsFocused] = useState(false);
  const [animatedLabel] = useState(new Animated.Value(value ? 1 : 0));

  const handleFocus = () => {
    setIsFocused(true);
    Animated.timing(animatedLabel, {
      toValue: 1,
      duration: theme.animation.fast,
      useNativeDriver: false,
    }).start();
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (!value) {
      Animated.timing(animatedLabel, {
        toValue: 0,
        duration: theme.animation.fast,
        useNativeDriver: false,
      }).start();
    }
  };

  const labelStyle = {
    position: 'absolute' as const,
    left: icon ? 44 : theme.spacing(2),
    top: animatedLabel.interpolate({
      inputRange: [0, 1],
      outputRange: [multiline ? 18 : 16, -8],
    }),
    fontSize: animatedLabel.interpolate({
      inputRange: [0, 1],
      outputRange: [theme.typography.body, theme.typography.caption],
    }),
    color: error
      ? theme.colors.danger
      : isFocused
      ? theme.colors.primary
      : theme.colors.textTertiary,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 4,
    zIndex: 1,
  } as Animated.WithAnimatedObject<TextStyle>;

  const containerBorderColor = error
    ? theme.colors.danger
    : isFocused
    ? theme.colors.primary
    : theme.colors.border;

  return (
    <View style={[styles.wrapper, style]}>
      <View style={[
        styles.container,
        {
          borderColor: containerBorderColor,
          borderWidth: isFocused ? 2 : 1,
          minHeight: multiline ? numberOfLines * 24 + theme.spacing(4) : 52,
          backgroundColor: disabled ? theme.colors.backgroundDark : theme.colors.surface,
        },
        !disabled && theme.shadows.sm,
      ]}>
  <Animated.Text style={labelStyle}>
          {label}
        </Animated.Text>
        
        {icon && (
          <View style={styles.iconContainer}>
            <SafeIonicons
              name={icon as any}
              size={20}
              color={error ? theme.colors.danger : isFocused ? theme.colors.primary : theme.colors.textTertiary}
            />
          </View>
        )}
        
        <TextInput
          style={[
            styles.input,
            {
              paddingLeft: icon ? 44 : theme.spacing(2),
              textAlignVertical: multiline ? 'top' : 'center',
              height: multiline ? numberOfLines * 24 : 'auto',
              color: disabled ? theme.colors.disabled : theme.colors.text,
            },
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textTertiary}
          onFocus={handleFocus}
          onBlur={handleBlur}
          secureTextEntry={secureTextEntry}
          multiline={multiline}
          numberOfLines={numberOfLines}
          keyboardType={keyboardType}
          editable={!disabled}
        />
      </View>
      
      {error && (
        <View style={styles.errorContainer}>
          <SafeIonicons name="alert-circle" size={14} color={theme.colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    wrapper: {
      marginBottom: theme.spacing(2),
    },
    container: {
      borderRadius: theme.radii.md,
      position: 'relative',
    },
    iconContainer: {
      position: 'absolute',
      left: theme.spacing(2),
      top: 16,
      zIndex: 1,
    },
    input: {
      fontSize: theme.typography.body,
      paddingHorizontal: theme.spacing(2),
      paddingTop: theme.spacing(2.5),
      paddingBottom: theme.spacing(1),
      borderRadius: theme.radii.md,
    },
    errorContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: theme.spacing(0.5),
      paddingLeft: theme.spacing(1),
    },
    errorText: {
      color: theme.colors.danger,
      fontSize: theme.typography.caption,
      marginLeft: theme.spacing(0.5),
    },
  });
