// Global type declarations for ParcelApp

// Allow for __DEV__ global
declare const __DEV__: boolean;

// Avoid redeclaring 'require' when node types are present. If you need a global
// require in non-Node environments, use explicit imports or module-specific code.

// Fix issue with GestureHandlerRootView
declare module 'react-native-gesture-handler' {
  // Keep this minimal to avoid depending on react-native types in the global
  // declaration file used by the editor. Consumers can import proper types as needed.
  export const GestureHandlerRootView: any;
}

// Fix issue with react-native-paper.d.ts
declare module 'react-native-paper' {
  export const Card: any;
  export const Divider: any;
  export const ActivityIndicator: any;
  export const Button: any;
  export const Colors: any;
}
