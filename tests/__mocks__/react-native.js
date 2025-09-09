const React = require('react');

// Minimal mock implementations of common RN components and APIs used in tests.
module.exports = {
  Platform: { OS: 'android', select: (obj) => (obj && obj.android ? obj.android : undefined) },
  PixelRatio: { get: () => 1 },
  Dimensions: { get: () => ({ width: 360, height: 640 }) },
  StyleSheet: {
    create: (s) => s,
    // Simple flatten implementation for tests (accepts object or array)
    flatten: (style) => {
      if (Array.isArray(style)) return Object.assign({}, ...style.filter(Boolean));
      return style || {};
    },
  },
  useWindowDimensions: () => ({ width: 360, height: 640 }),
  Linking: { openURL: jest.fn(() => Promise.resolve(true)) },
  PermissionsAndroid: { request: jest.fn(() => Promise.resolve('granted')), RESULTS: { GRANTED: 'granted' } },
  Alert: { alert: jest.fn() },
  SafeAreaView: (props) => React.createElement('View', props, props.children),
  View: (props) => React.createElement('View', props, props.children),
  Text: (props) => React.createElement('Text', { accessibilityRole: props.onPress ? 'button' : undefined, ...props }, props.children),
  ScrollView: (props) => React.createElement('ScrollView', props, props.children),
  TouchableOpacity: (props) => React.createElement('TouchableOpacity', props, props.children),
  ActivityIndicator: (props) => React.createElement('ActivityIndicator', props, null),
  FlatList: (props) => React.createElement('FlatList', props, props.children),
  Modal: (props) => props.visible ? React.createElement('Modal', props, props.children) : null,
  InteractionManager: { runAfterInteractions: (cb) => cb && cb() },
  // Fallbacks
  PlatformColor: (c) => c,
};
