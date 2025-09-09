import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import theme from '../theme';

type Props = {
  title: string;
  subtitle?: string;
  tag?: string;
  onPress?: () => void;
};

export default function CardRow({ title, subtitle, tag, onPress }: Props) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} accessibilityRole="button">
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {tag ? <View style={styles.tag}><Text style={styles.tagTxt}>{tag}</Text></View> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: theme.colors.surface, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: theme.colors.border },
  title: { fontSize: theme.typography.h3, color: theme.colors.text, fontWeight: '700' },
  subtitle: { color: theme.colors.muted, fontSize: theme.typography.body },
  tag: { backgroundColor: theme.colors.success, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 12 },
  tagTxt: { color: '#fff', fontWeight: '700', fontSize: 12 }
});
