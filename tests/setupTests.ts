// Central test setup: reset mocks between tests and preserve Linking.openURL
const RN = require('react-native');

// Preserve original Linking.openURL so individual tests can mock safely
if (RN && RN.Linking && RN.Linking.openURL) {
  (global as any).__origLinkOpen = RN.Linking.openURL;
}

beforeEach(() => {
  // Reset all mocks to avoid leak between tests
  jest.resetAllMocks();
  // Ensure Linking.canOpenURL is mocked to allow dial flows in tests
  try {
    if (RN && RN.Linking) {
      if (!RN.Linking.canOpenURL) RN.Linking.canOpenURL = jest.fn(() => Promise.resolve(true));
    } else if (RN) {
      RN.Linking = { canOpenURL: jest.fn(() => Promise.resolve(true)) };
    }
  } catch (e) { /* ignore */ }
});

afterAll(() => {
  // Restore original Linking.openURL if it was saved
  const orig = (global as any).__origLinkOpen;
  if (orig && RN && RN.Linking) RN.Linking.openURL = orig;
});

// Increase default timeout for slower environments
jest.setTimeout(20000);
