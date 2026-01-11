/**
 * XamLeydi v2.0 - Bottom Tab Navigator
 * Modern bottom navigation with 3 tabs: Accueil, Carte, Plaintes
 */

import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeIonicons } from '../components/SafeIcons';
import { useDesignTheme } from './ThemeContext';
import { layout, shadows } from './designSystem';

// Import screens
import HomeScreen from '../screens/v2/HomeScreen';
import MapScreen from '../screens/v2/MapScreen';
import ComplaintsScreen from '../screens/v2/ComplaintsScreen';

const Tab = createBottomTabNavigator();

interface TabIconProps {
  name: string;
  focused: boolean;
  color: string;
  size: number;
}

const TabIcon: React.FC<TabIconProps> = ({ name, focused, color, size }) => {
  return (
    <View style={styles.iconContainer}>
      <SafeIonicons
        name={(focused ? name : `${name}-outline`) as any}
        size={size}
        color={color}
      />
    </View>
  );
};

export default function BottomTabNavigator() {
  const insets = useSafeAreaInsets();
  const { theme } = useDesignTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: theme.colors.tabBar,
          borderTopWidth: 1,
          borderTopColor: theme.colors.tabBarBorder,
          height: layout.bottomNavHeight + (Platform.OS === 'ios' ? insets.bottom : 0),
          paddingBottom: Platform.OS === 'ios' ? insets.bottom : 8,
          paddingTop: 8,
          ...shadows.md,
        },
        tabBarActiveTintColor: theme.colors.tabBarActive,
        tabBarInactiveTintColor: theme.colors.tabBarInactive,
      }}
    >
      <Tab.Screen
        name="Accueil"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ focused, color, size }: { focused: boolean; color: string; size: number }) => (
            <TabIcon name="home" focused={focused} color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Carte"
        component={MapScreen}
        options={{
          tabBarIcon: ({ focused, color, size }: { focused: boolean; color: string; size: number }) => (
            <TabIcon name="map" focused={focused} color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Plaintes"
        component={ComplaintsScreen}
        options={{
          tabBarIcon: ({ focused, color, size }: { focused: boolean; color: string; size: number }) => (
            <TabIcon name="document-text" focused={focused} color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
