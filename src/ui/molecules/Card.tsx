import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeIonicons } from '../../components/SafeIcons';
import theme from '../theme';

type CardProps = {
  title: string;
  icon?: string;
  iconColor?: string;
  children: React.ReactNode;
  expandable?: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
};

/**
 * Card - A standard container with title and optional expand/collapse functionality
 */
export default function Card({
  title,
  icon,
  iconColor = theme.colors.primary,
  children,
  expandable = false,
  expanded = true,
  onToggleExpand
}: CardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.titleContainer}>
          {icon && (
            <SafeIonicons name={icon} size={24} color={iconColor} style={styles.headerIcon} />
          )}
          <Text style={styles.cardTitle}>{title}</Text>
        </View>
        
        {expandable && (
          <TouchableOpacity onPress={onToggleExpand} style={styles.expandButton}>
            <SafeIonicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={24}
              color={theme.colors.muted}
            />
          </TouchableOpacity>
        )}
      </View>
      
      <View style={styles.divider} />
      
      {(expanded || !expandable) && (
        <View style={styles.cardContent}>
          {children}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    marginHorizontal: theme.spacing(2),
    marginBottom: theme.spacing(2),
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    overflow: 'hidden'
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing(2),
    paddingVertical: theme.spacing(2)
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  headerIcon: {
    marginRight: theme.spacing(1)
  },
  cardTitle: {
    fontSize: theme.typography.h2,
    fontWeight: 'bold',
    color: theme.colors.text
  },
  expandButton: {
    padding: theme.spacing(0.5)
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border
  },
  cardContent: {
    padding: theme.spacing(2)
  }
});
