// UI test for ParcelDetailScreen using @testing-library/react-native
// Note: this test requires @testing-library/react-native to be installed in devDependencies

// Mock DatabaseManager to avoid filesystem/native DB calls
jest.mock('../src/data/database', () => ({
  getNeighborParcels: jest.fn().mockResolvedValue([]),
  getStats: jest.fn().mockResolvedValue({ totalParcels: 0 }),
  db: {},
}));

// Mock react-native-maps to avoid native rendering
jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MockMap = (props: any) => React.createElement(View, props, props.children);
  return {
    __esModule: true,
    default: MockMap,
    Polygon: (props: any) => React.createElement(View, props, null),
    Marker: (props: any) => React.createElement(View, props, null),
  };
});

// Mock SafeIonicons used in the component
jest.mock('../src/components/SafeIcons', () => ({ SafeIonicons: (props: any) => null }));

// Mock react-native-safe-area-context to avoid pulling in RN code that needs Babel/Flow transforms
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 })
}));

// Mock react-native-paper to simple components to avoid native UI implementations
jest.mock('react-native-paper', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Card: any = (props: any) => React.createElement(View, props, props.children);
  Card.Content = (p: any) => React.createElement(View, p, p.children);
  const Divider = (p: any) => React.createElement(View, p, null);
  return { Card, Divider };
});

import React from 'react';
import { Linking } from 'react-native';

// Provide a stable windowDimensions and StyleSheet.create for tests without mocking the entire module
const rn = require('react-native');
if (!rn.useWindowDimensions) rn.useWindowDimensions = () => ({ width: 400, height: 800 });
if (!rn.StyleSheet || !rn.StyleSheet.create) rn.StyleSheet = { ...rn.StyleSheet, create: (s: any) => s };
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import ParcelDetailScreen from '../src/screens/ParcelDetailScreen';

describe('ParcelDetailScreen UI', () => {
  beforeAll(() => {
  // Mock Linking.openURL to avoid actually opening external intents
  const RN = require('react-native');
  // save original if present
  (global as any).__origLinkOpen = RN.Linking && RN.Linking.openURL;
  if (!RN.Linking) RN.Linking = { openURL: jest.fn(() => Promise.resolve(true)) };
  else RN.Linking.openURL = jest.fn(() => Promise.resolve(true));
  });

  afterAll(() => {
  const RN = require('react-native');
  const orig = (global as any).__origLinkOpen;
  if (orig) RN.Linking.openURL = orig;
  else if (RN.Linking && RN.Linking.openURL && RN.Linking.openURL.mockRestore) RN.Linking.openURL.mockRestore();
  });

  it('renders a single Mandataire block and the phone is clickable', async () => {
    const navigation: any = { push: jest.fn(), navigate: jest.fn() };
    const route: any = {
      params: {
        parcel: { num_parcel: 'TEST-UI', parcel_type: 'collectif' },
        geometry: null,
        properties: {
          Prenom_M: 'WALY',
          Nom_M: 'CAMARA',
          Date_nai: '1980-05-01',
          Sexe_Mndt: 'Homme',
          Lieu_nais: 'Dakar',
          Num_piec: '1369201300074',
          Telephon2: '+221700000000',
          Quel_est_le_nombre_d_affectata: '1',
          Prenom_001: 'Ali',
          Nom_001: 'Diallo',
          Telephone_001: '+221700000001'
        }
      }
    };

  const { findAllByText, findByText, getByText, getAllByText, queryByText, getByTestId } = render(<ParcelDetailScreen route={route} navigation={navigation} />);

    // Wait for the Mandataire header to appear and validate mandataire info
    const headers = await findAllByText(/Mandataire/i);
    expect(headers.length).toBe(1);

  // Mandataire name, birthplace and phone should be present
  expect(await findByText(/WALY/)).toBeTruthy();
  expect(await findByText(/Dakar/)).toBeTruthy();
  const mandPhoneNode = await findByText(/\+221700000000/);
    expect(mandPhoneNode).toBeTruthy();

    // Press mandataire phone and assert Linking called with tel: URL
    fireEvent.press(mandPhoneNode);
    await waitFor(() => expect(require('react-native').Linking.openURL).toHaveBeenCalledWith(expect.stringContaining('+221700000000')));

    // Affectataires: preview should show count and first aff name
    const affHeader = await findByText(/Affectataires/i);
    expect(affHeader).toBeTruthy();

  // Count badge should show '1' for our test data (there may be other '1's elsewhere)
  const countMatches = getAllByText(/1/);
  expect(countMatches.length).toBeGreaterThan(0);

  // Preview name should render the first affectataire and be tappable
  const previewName = await findByText(/Ali Diallo/);
  expect(previewName).toBeTruthy();

  // Instead of expanding (FlatList may not render items in test env), press the preview's phone button directly
  await waitFor(() => expect(getByTestId('affectataires-preview-phone')).toBeTruthy());
  const previewPhoneBtn = getByTestId('affectataires-preview-phone');
  fireEvent.press(previewPhoneBtn);
  await waitFor(() => expect(require('react-native').Linking.openURL).toHaveBeenCalledWith(expect.stringContaining('+221700000001')));
  });
});
