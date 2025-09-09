import 'react-native-get-random-values';
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, StatusBar, LogBox } from 'react-native';

// Enable react-native-screens early
import { enableScreens } from 'react-native-screens';
// Prefer the JS implementation if the native module isn't available in this environment.
// Calling enableScreens(false) forces the JS fallback which avoids native crashes like
// "AppRegistryBinding :: stopSurface failed. Global was not installed." when the
// native screens module isn't linked into the build.
try {
  enableScreens(false);
} catch (e) {
  // If something unexpected happens, log and continue with the JS implementation.
  // This prevents the app from crashing at startup when native screens are absent.
  // eslint-disable-next-line no-console
  console.warn('react-native-screens: forcing JS implementation', e);
}

import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
// Removed PaperProvider and ActivityIndicator from react-native-paper
import theme from './src/theme';
import { SafeAreaProvider } from 'react-native-safe-area-context';
// Safe wrapper for GestureHandlerRootView: some environments (Expo Go / dev clients)
// may have different export shapes for the gesture-handler package. Use a runtime
// require and fall back to View to avoid crashing with "Element type is invalid".
let GestureHandlerRootView: any = null;
try {
  // prefer named export when available
  const gh = require('react-native-gesture-handler');
  GestureHandlerRootView = gh?.GestureHandlerRootView ?? gh?.default ?? null;
} catch (e) {
  GestureHandlerRootView = null;
}
if (!GestureHandlerRootView) {
  // fallback component that renders a plain View
  // eslint-disable-next-line react/display-name
  GestureHandlerRootView = ({ children, style }: any) => require('react').createElement(require('react-native').View, { style }, children);
}
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
          // require the prebuilt DB so Metro/Expo includes it in the app bundle
          const dbAsset = Asset.fromModule(require('./prebuilt/parcelapp.db'));
          await dbAsset.downloadAsync().catch(() => {});
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