import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import theme from '../theme';
// debug: ensure theme loads correctly
try {
  // eslint-disable-next-line no-console
  console.log('ParcelRow theme:', typeof theme, theme && typeof theme === 'object' ? Object.keys(theme) : theme);
} catch (e) {
  // eslint-disable-next-line no-console
  console.error('ParcelRow theme log failed', e);
}

interface Props {
  num_parcel: string;
  parcel_type: string;
  ownerDisplay: string;
  village?: string;
  onPress?: () => void;
}

const ParcelRowComponent: React.FC<Props> = ({ num_parcel, parcel_type, ownerDisplay, village, onPress }) => {
  const typeColor = parcel_type === 'individuel' ? theme.appColors.secondary : theme.appColors.accent;
  return (
    <TouchableOpacity onPress={onPress} style={styles.container} activeOpacity={0.7}>
      <View style={styles.left}>
        <Text style={styles.parcelNumber}>{num_parcel}</Text>
        <Text style={styles.owner} numberOfLines={1}>{ownerDisplay}</Text>
      </View>
      <View style={styles.right}>
        <Text style={[styles.type, { color: typeColor }]}>
          {parcel_type === 'individuel' ? 'Individuel' : 'Collectif'}
        </Text>
        {village ? <Text style={styles.village}>{village}</Text> : null}
      </View>
    </TouchableOpacity>
  );
};

// Memoize to prevent unnecessary re-renders when props are unchanged
export const MemoizedParcelRow = React.memo(ParcelRowComponent, (prev, next) => (
  prev.num_parcel === next.num_parcel &&
  prev.parcel_type === next.parcel_type &&
  prev.ownerDisplay === next.ownerDisplay &&
  prev.village === next.village
));

export default ParcelRowComponent;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
  backgroundColor: theme.appColors.surface,
    borderRadius: 8,
    marginVertical: 6,
    elevation: 1,
  },
  left: { flex: 1 },
  right: { alignItems: 'flex-end', width: 120 },
  parcelNumber: { fontSize: 16, fontWeight: '700', color: theme.appColors.text },
  owner: { fontSize: 13, color: theme.appColors.subtext, marginTop: 4 },
  type: { fontSize: 12, fontWeight: '600' },
  village: { fontSize: 11, color: theme.appColors.subtext, marginTop: 6 },
});
