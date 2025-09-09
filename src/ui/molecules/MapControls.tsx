import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { SafeIonicons } from '../../components/SafeIcons';
import theme from '../theme';

type MapControlsProps = {
  onCenterParcel: () => void;
  onToggleNeighbors: () => void;
  onToggleMap: () => void;
  showNeighbors: boolean;
  showMap: boolean;
  onNavigate?: () => void;
  navigateDisabled?: boolean;
};

/**
 * Enhanced map control buttons for the ParcelDetailScreen
 * 
 * Provides buttons for centering on parcel, toggling neighbors visibility, and hiding/showing map
 */
const MapControls = ({ 
  onCenterParcel, 
  onToggleNeighbors, 
  onToggleMap,
  showNeighbors,
  showMap,
  onNavigate,
  navigateDisabled
}: MapControlsProps) => {
  return (
    // Floating overlay container: keep functionality identical but present as compact circular buttons
    <View pointerEvents="box-none" style={styles.overlay}>
      <View style={styles.fabBackground} pointerEvents="box-none">
        <View style={styles.fabColumn}>
        <TouchableOpacity
          accessibilityLabel="Centrer la parcelle"
          onPress={onCenterParcel}
          style={[styles.fabButton, styles.primaryFab]}
          activeOpacity={0.85}
        >
          <SafeIonicons name="locate" size={20} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityLabel="Basculer parcelles voisines"
          onPress={onToggleNeighbors}
          style={[
            styles.fabButton,
            showNeighbors ? styles.activeFab : styles.secondaryFab,
          ]}
          activeOpacity={0.85}
        >
          <SafeIonicons name={showNeighbors ? 'layers' : 'layers-outline'} size={20} color={showNeighbors ? '#fff' : theme.colors.text} />
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityLabel={showMap ? 'Cacher la carte' : 'Afficher la carte'}
          onPress={onToggleMap}
          style={[styles.fabButton, styles.secondaryFab]}
          activeOpacity={0.85}
        >
          <SafeIonicons name={showMap ? 'eye-off-outline' : 'eye-outline'} size={20} color={theme.colors.text} />
        </TouchableOpacity>
        {/* optional navigate button */}
        {typeof onNavigate === 'function' && (
          <TouchableOpacity
            accessibilityLabel="Naviguer vers parcelle"
            onPress={onNavigate}
            style={[styles.fabButton, styles.primaryFab, !!navigateDisabled && { opacity: 0.5 }]}
            disabled={!!navigateDisabled}
            activeOpacity={0.85}
          >
            <SafeIonicons name="navigate" size={20} color="#fff" />
          </TouchableOpacity>
        )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
  // legacy - unused
  backgroundColor: theme.colors.background,
  paddingVertical: 12,
  paddingHorizontal: 16,
  borderRadius: 8,
  marginBottom: 8
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 8
  },
  controlsRow: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  },
  controlButton: {
  // legacy - unused
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  paddingVertical: 8,
  paddingHorizontal: 12,
  borderRadius: 6,
  minWidth: 90,
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
  },
  secondaryButton: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.muted,
  },
  activeButton: {
  backgroundColor: '#5CB85C',  // Using the accent color value directly
  },
  buttonText: {
    fontSize: 14,
    marginLeft: 6,
  },
  activeButtonText: {
    color: '#fff',
    fontWeight: '500',
  },
  secondaryButtonText: {
    color: theme.colors.text,
  }
  ,
  /* New styles for floating FABs */
  overlay: {
  // non-positioned container: parent should position this component
  // keep transparent background so touches pass through where there is no visible child
  backgroundColor: 'transparent',
  alignItems: 'flex-end',
  },
  fabColumn: {
    flexDirection: 'column',
    alignItems: 'center',
  // ensure consistent vertical spacing across platforms
  paddingVertical: 4,
  },
  fabBackground: {
  backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: 12,
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 8,
  },
  fabButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  marginVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 6,
  },
  primaryFab: {
    backgroundColor: theme.colors.primary,
  },
  secondaryFab: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.muted,
  },
  activeFab: {
    backgroundColor: '#2E7D32',
  },
});

export default MapControls;
