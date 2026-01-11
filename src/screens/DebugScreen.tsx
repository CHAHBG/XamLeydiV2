import React from 'react';
import { View, Text } from 'react-native';

// Debug screen was removed for production builds. Keep a minimal stub so
// any stray imports won't crash the app during runtime.
export default function DebugScreen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Debug screen removed</Text>
    </View>
  );
}
