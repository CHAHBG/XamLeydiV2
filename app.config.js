import 'dotenv/config';

// Dynamic Expo config.
// Keeps secrets (API keys) out of versioned files by reading from env vars.
export default ({ config }) => {
  const googleMapsApiKey =
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
    process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

  if (googleMapsApiKey) {
    config.android = config.android ?? {};
    config.android.config = config.android.config ?? {};
    config.android.config.googleMaps = {
      ...(config.android.config.googleMaps ?? {}),
      apiKey: googleMapsApiKey,
    };

    // Some native modules (and certain setups) also read the iOS key from expo.ios.config
    config.ios = config.ios ?? {};
    config.ios.config = config.ios.config ?? {};
    config.ios.config.googleMapsApiKey = googleMapsApiKey;
  }

  // Pass Supabase config through extra so it's accessible in JS at runtime
  config.extra = config.extra ?? {};
  config.extra.REACT_APP_SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || null;
  config.extra.REACT_APP_SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || null;

  return config;
};
