import 'react-native-get-random-values';
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, StatusBar, LogBox } from 'react-native';

// Disable excessive logging for better performance
LogBox.ignoreLogs([
  'Non-serializable values were found in the navigation state',
  'VirtualizedLists should never be nested',
  'Remote debugger',
]);

// Enable react-native-screens early for better navigation performance
import { enableScreens } from 'react-native-screens';
try {
  // Enable native screens for better performance when possible
  enableScreens(true);
} catch (e) {
  console.warn('react-native-screens: forcing JS implementation', e);
}

import {
  NavigationContainer,
} from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { ThemeProvider, useAppTheme, useThemeMode } from './src/ui/ThemeProvider';
import { DesignThemeProvider, useDesignTheme } from './src/ui/ThemeContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';
// Import gesture handler safely with fallback
import * as GH from 'react-native-gesture-handler';
const GestureHandlerRootView = (GH as any).GestureHandlerRootView || View;
import DatabaseLoading from './src/components/DatabaseLoading';

// V2 Screens with new design
import BottomTabNavigator from './src/ui/BottomTabNavigator';
import { ComplaintWizardScreen, ParcelDetailScreen, ComplaintEditScreen as ComplaintEditScreenV2, AproposScreen as AproposScreenV2 } from './src/screens/v2';

// Legacy screens (still needed for detail views)
import ModernSearchScreen from './src/screens/ModernSearchScreen';
import LegacyParcelDetailScreen from './src/screens/ParcelDetailScreen';
import ComplaintFormScreen from './src/screens/ComplaintFormScreen';
import ComplaintExportScreen from './src/screens/ComplaintExportScreen';
import ComplaintEditScreenLegacy from './src/screens/ComplaintEditScreen';
// DebugScreen removed in production builds
import DatabaseManager from './src/data/database';
import Constants from 'expo-constants';
import { Asset } from 'expo-asset';
import * as Font from 'expo-font';
import { Ionicons } from '@expo/vector-icons';

// Minimal error boundary to catch native rendering errors (like native module mismatches)
class ErrorBoundary extends React.Component<any, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: any, info: any) {
    // log for debugging
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught:', error, info);
  }
  render() {
    if (this.state.hasError) {
      // Fallback UI keeps app responsive while avoiding recursive failures
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text>Une erreur inattendue est survenue.</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

export type RootStackParamList = {
  Main: undefined;
  Search: undefined;
  ParcelDetail: { parcel: any }; // Replace 'any' with your actual parcel type if available
  ComplaintForm: { parcelNumber?: string } | undefined;
  ComplaintWizard: { parcel?: any } | undefined;
  ComplaintDetail: { complaint: any } | undefined;
  ComplaintExport: undefined;
  ComplaintEdit: { complaint: any } | undefined;
  Apropos: undefined;
  Settings: undefined;
  QRScanner: undefined;
  Debug: undefined;
};

const Stack = createStackNavigator();
// Add a small utility that helps debug "type is invalid" errors by checking 
// component types before rendering
const debugComponent = (name: string, Component: any): any => {
  if (!Component) {
    console.warn(`[DEBUG] Component ${name} is undefined`);
    return (props: any) => null; // Return a valid null-rendering component
  }
  if (typeof Component === 'object' && !Component.$$typeof) {
    console.warn(`[DEBUG] Component ${name} is an object, not a component:`, Component);
    return (props: any) => null;
  }
  return Component;
};

// Check all top-level providers that may be giving the invalid component error
const DebugSafeAreaProvider = debugComponent('SafeAreaProvider', SafeAreaProvider);
const DebugPaperProvider = ({ children }: any) => <React.Fragment>{children}</React.Fragment>;
const DebugDatabaseLoading = debugComponent('DatabaseLoading', DatabaseLoading);
const DebugNavigationContainer = debugComponent('NavigationContainer', NavigationContainer);
const DebugGestureHandlerRootView = debugComponent('GestureHandlerRootView', GestureHandlerRootView);

// Silence a known dev warning coming from nested SafeAreaProvider / native
// libraries that call `useInsertionEffect` which may log during development.
// This is safe to ignore in dev; remove if you want to see the raw warning.
if (__DEV__) {
  LogBox.ignoreLogs(['useInsertionEffect must not schedule updates']);
}

function AppContent() {
  const [dbReady, setDbReady] = useState(false);
  const [error, setError] = useState(null as string | null);
  const [_dbSeeding, setDbSeeding] = useState(false);
  const theme = useAppTheme();
  const { isDark } = useThemeMode();
  const navigationTheme = useMemo(() => {
    return {
      dark: isDark,
      colors: {
        background: theme.colors.background,
        card: theme.colors.surface,
        text: theme.colors.text,
        border: theme.colors.border,
        primary: theme.colors.primary,
        notification: theme.colors.primary,
      },
    };
  }, [isDark, theme]);

  useEffect(() => {
    console.log('Initializing app...');
    initializeApp();
  }, []);

  // Configure Supabase client for remote submission if environment vars are present
  useEffect(() => {
    try {
      // Try multiple sources for env vars (Expo Constants, process.env, global)
      // - `extra` is baked at build time via app.config.js
      // - `EXPO_PUBLIC_*` can be inlined at bundle time in Expo
      const extra =
        (Constants.expoConfig as any)?.extra ||
        (Constants as any).manifest?.extra ||
        (Constants as any).manifest2?.extra ||
        {};

      const url =
        extra.REACT_APP_SUPABASE_URL ||
        extra.EXPO_PUBLIC_SUPABASE_URL ||
        (process.env as any).EXPO_PUBLIC_SUPABASE_URL ||
        (process.env as any).REACT_APP_SUPABASE_URL ||
        (global as any).EXPO_PUBLIC_SUPABASE_URL ||
        (global as any).REACT_APP_SUPABASE_URL ||
        null;

      const key =
        extra.REACT_APP_SUPABASE_ANON_KEY ||
        extra.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
        (process.env as any).EXPO_PUBLIC_SUPABASE_ANON_KEY ||
        (process.env as any).REACT_APP_SUPABASE_ANON_KEY ||
        (global as any).EXPO_PUBLIC_SUPABASE_ANON_KEY ||
        (global as any).REACT_APP_SUPABASE_ANON_KEY ||
        null;
      
      console.log('[Supabase] Config check:', { 
        hasUrl: !!url, 
        hasKey: !!key,
        urlPrefix: url ? url.substring(0, 20) + '...' : 'none'
      });
      
      DatabaseManager.setSupabaseConfig(url, key);
    } catch (e) {
      console.warn('[Supabase] Failed to set config from env:', e);
    }
  }, []);

  const initializeApp = async () => {
    try {
      // Ensure prebuilt DB asset is downloaded to the device filesystem so the DB copy in DatabaseManager can run quickly
      try {
        // In development we avoid requiring the large prebuilt DB so Metro doesn't
        // include it in the JS bundle. Only attempt to preload the DB asset when
        // running a production build or CI where bundling the DB is desired.
        if (!__DEV__) {
          // Avoid static `require('./prebuilt/parcelapp.db')` which makes Metro
          // try to resolve the file at bundle time (this can fail on remote CI
          // if the asset isn't present in the packager graph). Use a dynamic
          // runtime require via eval so Metro won't attempt to resolve it, and
          // fall back silently if it isn't available.
          try {
            const dynamicRequire: any = eval('require');
            const mod = dynamicRequire('./prebuilt/parcelapp.db');
            if (mod) {
              const dbAsset = Asset.fromModule(mod);
              await dbAsset.downloadAsync().catch(() => {});
            }
          } catch (e) {
            // ignore: missing prebuilt DB is acceptable; DatabaseManager handles it
          }
        }
      } catch (e) {
        // ignore if asset not found; DatabaseManager already handles missing prebuilt DB
      }

      // Preload icon fonts to avoid flicker and slow icon appearance on first render
      try {
        await Font.loadAsync({ ...(Ionicons as any).font });
      } catch (e) {
        // ignore font load errors; app can still render
        console.warn('Font preload failed', e);
      }

      // Initialize DB but allow seeding to run in background so UI is responsive quickly.
      setDbSeeding(true);
      // initializeDatabase will connect and create tables synchronously; pass backgroundSeed to seed asynchronously
      await DatabaseManager.initializeDatabase({ backgroundSeed: true });
      // Once connected (db assigned), mark ready so navigation and UI can mount. Seeding may still be running.
      setDbReady(true);
      // Listen for seeding progress to clear the seeding flag when done
      const listener = (p: { inserted: number; total: number } | null) => {
        if (p == null) setDbSeeding(false);
      };
      DatabaseManager.addSeedingListener(listener);
      // If seeding already finished, clear immediately
      if (!DatabaseManager.seedingProgress) setDbSeeding(false);
    } catch (error) {
      console.error('Failed to initialize database:', error);
      setError("Erreur lors de l'initialisation de la base de données");
      setDbReady(true);
    }
  };

  if (!dbReady) {
    return (
      <DebugPaperProvider>
        <DebugSafeAreaProvider>
          <StatusBar
            barStyle={isDark ? 'light-content' : 'dark-content'}
            backgroundColor={theme.colors.background}
          />
          <DebugDatabaseLoading onContinue={() => { setDbReady(true); setDbSeeding(false); }} />
        </DebugSafeAreaProvider>
      </DebugPaperProvider>
    );
  }

  if (error) {
    return (
      <DebugPaperProvider>
        <DebugSafeAreaProvider>
          <StatusBar
            barStyle={isDark ? 'light-content' : 'dark-content'}
            backgroundColor={theme.colors.surface}
          />
          <View style={[styles.errorContainer, { backgroundColor: theme.colors.background }]}>
            <Text style={[styles.errorText, { color: theme.colors.danger }]}>{error}</Text>
          </View>
        </DebugSafeAreaProvider>
      </DebugPaperProvider>
    );
  }

  return (
    <DebugPaperProvider>
      <DebugSafeAreaProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <StatusBar
            barStyle={isDark ? 'light-content' : 'dark-content'}
            backgroundColor="transparent"
            translucent
          />
          <DesignThemeProvider>
            <DebugNavigationContainer theme={navigationTheme}>
              <Stack.Navigator
                initialRouteName="Main"
                screenOptions={{
                  headerStyle: {
                    backgroundColor: theme.colors.primary,
                    elevation: 0,
                    shadowOpacity: 0,
                  },
                  headerTintColor: '#FFFFFF',
                  headerTitleStyle: {
                    fontWeight: '600',
                    fontSize: 18,
                    color: '#FFFFFF',
                  },
                  // contentStyle is not a valid StackNavigationOptions prop; remove it
                }}
              >
                {/* Main Tab Navigator (v2 Design) */}
                <Stack.Screen
                  name="Main"
                  component={BottomTabNavigator}
                  options={{ headerShown: false }}
                />
                {/* Legacy Search Screen (accessible from Map tab) */}
                <Stack.Screen
                  name="Search"
                  component={debugComponent('ModernSearchScreen', ModernSearchScreen)}
                  options={{
                    title: 'Recherche de Parcelles',
                  }}
                />
                <Stack.Screen
                  name="ParcelDetail"
                  component={debugComponent('ParcelDetailScreen', ParcelDetailScreen)}
                  options={{ headerShown: false }}
                />
                {/* New Complaint Wizard (v2 Design) */}
                <Stack.Screen
                  name="ComplaintWizard"
                  component={debugComponent('ComplaintWizardScreen', ComplaintWizardScreen)}
                  options={{ headerShown: false }}
                />
                {/* Legacy complaint screens */}
                <Stack.Screen
                  name="ComplaintForm"
                  component={debugComponent('ComplaintFormScreen', ComplaintFormScreen)}
                  options={{ title: 'Enregistrement d\'une plainte' }}
                />
                <Stack.Screen
                  name="ComplaintEdit"
                  component={debugComponent('ComplaintEditScreenV2', ComplaintEditScreenV2)}
                  options={{ headerShown: false }}
                />
                <Stack.Screen
                  name="ComplaintExport"
                  component={debugComponent('ComplaintExportScreen', ComplaintExportScreen)}
                  options={{ title: 'Exporter les plaintes' }}
                />
                <Stack.Screen
                  name="Apropos"
                  component={debugComponent('AproposScreenV2', AproposScreenV2)}
                  options={{ headerShown: false }}
                />
              </Stack.Navigator>
            </DebugNavigationContainer>
          </DesignThemeProvider>
        </GestureHandlerRootView>
      </DebugSafeAreaProvider>
    </DebugPaperProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ErrorBoundary>
        <AppContent />
      </ErrorBoundary>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 32,
  },
  errorText: {
    fontSize: 16,
    color: '#f44336',
    textAlign: 'center',
    lineHeight: 24,
  },
});