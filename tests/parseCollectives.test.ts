// Mock native Expo modules that collectives module imports
jest.mock('expo-sqlite', () => ({
  openDatabaseSync: jest.fn(() => ({ execSync: jest.fn() })),
  openDatabase: jest.fn(() => ({ transaction: jest.fn() })),
}));
jest.mock('expo-file-system', () => ({}));
jest.mock('expo-asset', () => ({ Asset: { fromModule: () => ({ localUri: '' }) } }));
jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));

import collectives from '../src/data/collectives';

describe('collectives.parseCollectives', () => {
  test('parses newline-aggregated affectataires and combines into single entry', () => {
    const feature = {
      properties: {
        Num_parcel: 'P-123',
        Prenom: 'Ali\nMoussa',
        Nom: 'Diallo\nSow',
        Num_piece: 'ID1\nID2',
        Telephone: '700000001\n700000002'
      }
    } as any;
    const out = (collectives as any).parseCollectives([feature]);
    expect(Array.isArray(out)).toBe(true);
    expect(out.length).toBe(1);
    const combined = out[0];
    expect(String(combined.Prenom)).toContain('Ali');
    expect(String(combined.Nom)).toContain('Diallo');
  });

  test('skips collectives with insufficient affectataires', () => {
    const feature2 = { properties: { Num_parcel: 'P-200', Prenom: 'Solo' } } as any;
    const out2 = (collectives as any).parseCollectives([feature2]);
    expect(Array.isArray(out2)).toBe(true);
    expect(out2.length).toBe(0);
  });
});
