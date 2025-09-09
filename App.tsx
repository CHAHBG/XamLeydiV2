import 'react-native-get-random-values';
import React, { useEffect, useState, useCallback, Suspense } from 'react';
import { View, Text, StyleSheet, StatusBar, LogBox, Platform } from 'react-native';

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

import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
// Removed PaperProvider and ActivityIndicator from react-native-paper
import theme from './src/theme';
// debug: log theme shape at module load
try {
  // eslint-disable-next-line no-console
  console.log('APP THEME LOADED keys:', Object.keys(theme || {}));
  // eslint-disable-next-line no-console
  console.log('APP THEME appColors present:', !!(theme && (theme as any).appColors));
  // eslint-disable-next-line no-console
  console.log('APP THEME appColors keys:', theme && (theme as any).appColors ? Object.keys((theme as any).appColors) : null);
} catch (e) {
  // eslint-disable-next-line no-console
  console.warn('Error logging theme debug', e);
}
import { SafeAreaProvider } from 'react-native-safe-area-context';
// Import gesture handler safely with fallback
import * as GH from 'react-native-gesture-handler';
const GestureHandlerRootView = (GH as any).GestureHandlerRootView || View;
import DatabaseLoading from './src/components/DatabaseLoading';

import SearchScreen from './src/screens/SearchScreen';
import ParcelDetailScreen from './src/screens/ParcelDetailScreen';
import ComplaintFormScreen from './src/screens/ComplaintFormScreen';
import ComplaintExportScreen from './src/screens/ComplaintExportScreen';
import AproposScreen from './src/screens/AproposScreen';
import DebugScreen from './src/screens/DebugScreen';
import DatabaseManager from './src/data/database';
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
      // Fallback UI: render a basic screen so app remains usable
      return <SearchScreen />;
    }
    return this.props.children;
  }
}

type RootStackParamList = {
  Search: undefined;
  ParcelDetail: { parcel: any }; // Replace 'any' with your actual parcel type if available
  ComplaintForm: { parcelNumber?: string } | undefined;
  ComplaintExport: undefined;
  Apropos: undefined;
  Debug: undefined;
};

const Stack = createStackNavigator();

// theme imported from src/theme

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

const LoadingScreen = () => (
  <View style={styles.loadingContainer}>
    <View style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 4, borderColor: theme.appColors.secondary, borderTopColor: 'transparent', alignSelf: 'center', marginBottom: 16 }} />
    <Text style={styles.loadingText}>Initialisation de la base de données...</Text>
  </View>
);

export default function App() {
  const [dbReady, setDbReady] = useState(false);
  const [error, setError] = useState(null as string | null);
  const [dbSeeding, setDbSeeding] = useState(false);

  useEffect(() => {
  console.log('Initializing app...');
    initializeApp();
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
      console.error('Failed to initialize database:', error);
      setError('Erreur lors de l\'initialisation de la base de données');
  setDbReady(true);
    }
  };

  if (!dbReady) {
    return (
      <DebugPaperProvider>
        <DebugSafeAreaProvider>
          <DebugDatabaseLoading onContinue={() => { setDbReady(true); setDbSeeding(false); }} />
        </DebugSafeAreaProvider>
      </DebugPaperProvider>
    );
  }

  if (error) {
    return (
      <DebugPaperProvider>
        <DebugSafeAreaProvider>
          <StatusBar barStyle="dark-content" backgroundColor={theme.appColors.surface} />
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        </DebugSafeAreaProvider>
      </DebugPaperProvider>
    );
  }

  return (
  <DebugPaperProvider>
      <DebugSafeAreaProvider>
        <DebugGestureHandlerRootView style={{ flex: 1 }}>
          <StatusBar barStyle="light-content" backgroundColor={theme.appColors.primary} />
          <DebugNavigationContainer>
            <Stack.Navigator
            initialRouteName="Search"
            screenOptions={{
              headerStyle: {
                backgroundColor: theme.appColors.primary,
                elevation: 4,
                shadowOpacity: 0.25,
                shadowRadius: 4,
                shadowColor: '#000',
                shadowOffset: {
                  height: 2,
                  width: 0,
                },
              },
              headerTintColor: '#ffffff',
              headerTitleStyle: {
                fontWeight: 'bold',
                fontSize: 18,
              },
            }}
          >
            <Stack.Screen
              name="Search"
              component={debugComponent('SearchScreen', SearchScreen)}
              options={{
                title: 'Recherche de Parcelles',
              }}
            />
            <Stack.Screen
              name="ParcelDetail"
              // @ts-ignore - route params are dynamic in this project
              children={props => React.createElement(debugComponent('ParcelDetailScreen', ParcelDetailScreen as React.ComponentType<any>), { ...props, dbReady })}
              options={({ route }: { route: any }) => ({
                title: `Parcelle ${route.params?.parcel?.num_parcel || ''}`,
                headerStyle: {
                  backgroundColor: theme.appColors.secondary,
                },
              })}
            />
            <Stack.Screen
              name="ComplaintForm"
              component={debugComponent('ComplaintFormScreen', ComplaintFormScreen)}
              options={{ title: 'Enregistrement d\'une plainte' }}
            />
            <Stack.Screen
              name="ComplaintExport"
              component={debugComponent('ComplaintExportScreen', ComplaintExportScreen)}
              options={{ title: 'Exporter les plaintes' }}
            />
            <Stack.Screen
              name="Debug"
              component={debugComponent('DebugScreen', DebugScreen)}
              options={{ title: 'Debug DB' }}
            />
            <Stack.Screen
              name="Apropos"
              component={debugComponent('AproposScreen', AproposScreen)}
              options={{ title: 'A propos' }}
            />
          </Stack.Navigator>
          </DebugNavigationContainer>
        </DebugGestureHandlerRootView>
      </DebugSafeAreaProvider>
    </DebugPaperProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
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