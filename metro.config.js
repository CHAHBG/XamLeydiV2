// Use Expo's metro config directly
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

module.exports = (() => {
  const config = getDefaultConfig(__dirname);
  
  // Optimize Metro build performance
  config.maxWorkers = 4; // Adjust based on your CPU cores
  
  // Configure asset resizing - don't scale unnecessarily
  config.transformer.assetPlugins = ['expo-asset/tools/hashAssetFiles'];
  
  // Include extra folders Metro should watch/resolve from (node_modules and prebuilt JSON assets)
  config.watchFolders = [
    path.resolve(__dirname, 'node_modules'),
    path.resolve(__dirname, 'prebuilt'),
  ];
  
  // Add .db files as supported asset extensions so prebuilt database can be bundled
  config.resolver.assetExts = [...config.resolver.assetExts, 'db'];
  
  // Do not block the `prebuilt` folder - it contains JSON assets the app imports.
  config.resolver.blockList = [
    /\.git\/.*/,
    /android\/.*/,
    /ios\/.*/,
  // Ignore react-native gradle-plugin bin and gradle output folders which can contain transient files
  /node_modules\/@react-native\/gradle-plugin\/bin\/.*/,
  /node_modules\/@react-native\/gradle-plugin\/.*/,
  /node_modules\/@react-native\/gradle-plugin\/bin\\\\.gradle\\\\.*/,
  ];
  
  // Optimize for smaller bundle size and faster builds
  config.transformer.minifierPath = 'metro-minify-terser';
  config.transformer.minifierConfig = {
    compress: {
      drop_console: false, // Set to true for production builds
      drop_debugger: true,
    }
  };
  
  return config;
})();
