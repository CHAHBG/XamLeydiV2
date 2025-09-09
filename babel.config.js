module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Add React Native Reanimated plugin for better performance
      'react-native-reanimated/plugin',
      
      // Transform-remove-console plugin (optional for production builds)
      // process.env.NODE_ENV === 'production' && ['transform-remove-console'],
    ].filter(Boolean),
    
    // Enable caching for faster builds
    env: {
      development: {
        compact: false,
      },
      production: {
        // Production-specific settings
        compact: true,
      },
    },
  };
};
