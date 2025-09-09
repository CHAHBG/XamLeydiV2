import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, ViewStyle } from 'react-native';
import theme from '../theme';

type Props = {
  title: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  onPress?: () => void;
  loading?: boolean;
  style?: ViewStyle | ViewStyle[];
};

export default function CustomButton({ title, variant='primary', onPress, loading=false, style }: Props) {
  const bg = variant === 'ghost' ? 'transparent' : (variant === 'secondary' ? theme.colors.success : theme.colors.primary);
  const textColor = variant === 'ghost' ? theme.colors.primary : '#fff';
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.btn, { backgroundColor: bg }, style as any]}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      {loading ? <ActivityIndicator color={textColor} /> : <Text style={[styles.txt, { color: textColor }]}>{title}</Text>}
    </TouchableOpacity>
  );
}
const styles = StyleSheet.create({
  btn: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: theme.radii.md, alignItems: 'center', justifyContent: 'center' },
  txt: { fontWeight: '600', fontSize: theme.typography.body }
});
