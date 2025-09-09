import React from 'react';
import { View, StyleSheet } from 'react-native';
import theme from '../theme';

const SkeletonRow: React.FC = () => {
  return (
    <View style={styles.container}>
      <View style={styles.left}>
        <View style={styles.boneShort} />
        <View style={styles.boneLong} />
      </View>
      <View style={styles.right}>
        <View style={styles.boneTiny} />
        <View style={styles.boneTiny} />
      </View>
    </View>
  );
};

export default React.memo(SkeletonRow);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
  backgroundColor: theme.appColors.surface,
    borderRadius: 8,
    marginVertical: 6,
  },
  left: { flex: 1 },
  right: { width: 120, alignItems: 'flex-end' },
  boneShort: { height: 14, backgroundColor: theme.appColors.muted, width: '40%', borderRadius: 4, marginBottom: 8 },
  boneLong: { height: 12, backgroundColor: theme.appColors.muted, width: '80%', borderRadius: 4 },
  boneTiny: { height: 10, backgroundColor: theme.appColors.muted, width: 60, borderRadius: 4, marginBottom: 6 },
});
