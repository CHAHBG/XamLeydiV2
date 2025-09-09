import React from 'react';
import { View, TextInput, Text, StyleSheet, TextInputProps } from 'react-native';
import theme from '../theme';

type Props = TextInputProps & {
  label?: string;
  error?: string | null;
  icon?: React.ReactNode;
};

export default function Input({ label, error, icon, style, ...rest }: Props) {
  return (
    <View style={{ marginBottom: 12 }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.row] as any}>
        {icon ? <View style={{ marginRight: 8 }}>{icon}</View> : null}
        <TextInput style={[styles.input, style as any]} {...rest} />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: theme.typography.caption, color: theme.colors.muted, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, backgroundColor: theme.colors.surface, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border, color: theme.colors.text },
  error: { color: '#c62828', marginTop: 6 }
});
