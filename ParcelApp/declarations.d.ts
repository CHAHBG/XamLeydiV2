// Lightweight shims for native modules used in this project.
// These prevent TypeScript errors in development when @types packages aren't installed.
declare module 'expo-camera' {
  export const Camera: any;
  export const CameraType: any;
  export const requestPermissionsAsync: any;
  export const requestCameraPermissionsAsync: any;
  export const getAvailableCameraTypesAsync: any;
  const _default: any;
  export default _default;
}

declare module '@react-navigation/native' {
  export function useFocusEffect(cb: any): any;
  export const NavigationContainer: any;
  export function useNavigation(): any;
  const _default: any;
  export default _default;
}

declare module 'react-native-gesture-handler' {
  const _default: any;
  export default _default;
}

// fallback for any other missing module types
declare module '*';
