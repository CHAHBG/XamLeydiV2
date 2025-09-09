import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import theme from '../theme';
import { SafeIonicons } from '../../components/SafeIcons';

type InfoItemProps = {
  label: string;
  value: string;
  icon?: string;
  onPress?: () => void;
  isLink?: boolean;
  important?: boolean;
  testID?: string;
};

/**
 * InfoItem - Displays a label and value pair for property details
 * Use for form data display in cards and detail views
 */
export default function InfoItem({ 
  label, 
  value, 
  icon, 
  onPress, 
  isLink = false,
  important = false
  , testID
}: InfoItemProps) {
  const Container = onPress || isLink ? TouchableOpacity : View;
  
  return (
    <Container
      style={styles.row}
      onPress={onPress}
      disabled={!onPress && !isLink}
      testID={testID}
    >
      <Text style={styles.label}>{label}</Text>
      <View style={styles.valueContainer}>
        {icon && (
          <SafeIonicons 
            name={icon} 
            size={16} 
            color={isLink ? theme.colors.primary : theme.colors.muted}
            style={styles.icon} 
          />
        )}
        <Text 
          style={[
            styles.value, 
            important && styles.valueImportant,
            isLink && styles.valueLink
          ]}
          onPress={onPress}
          testID={testID ? `${testID}-value` : undefined}
        >
          {value}
        </Text>
      </View>
    </Container>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-start',
    justifyContent: 'space-between'
  },
  label: {
    fontSize: theme.typography.body,
    fontWeight: '600',
    color: theme.colors.muted,
    width: 140,
    marginRight: 12
  },
  valueContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center'
  },
  value: {
    fontSize: theme.typography.body,
    color: theme.colors.text,
    flex: 1,
    lineHeight: 20
  },
  valueImportant: {
    fontSize: theme.typography.h3,
    fontWeight: 'bold',
    color: theme.colors.primary
  },
  valueLink: {
    color: theme.colors.primary
  },
  icon: {
    marginRight: 6
  }
});
