// Mock native expo modules before importing DatabaseManager to avoid runtime errors in Jest
jest.mock('expo-file-system', () => ({
  documentDirectory: '/tmp/',
  getInfoAsync: jest.fn().mockResolvedValue({ exists: true, size: 0 }),
  makeDirectoryAsync: jest.fn().mockResolvedValue(true),
  copyAsync: jest.fn().mockResolvedValue(true),
}));

jest.mock('expo-asset', () => ({
  Asset: { fromModule: jest.fn(() => ({ downloadAsync: jest.fn().mockResolvedValue(true), localUri: null, uri: 'file:///tmp/parcelapp.db' })) }
}));

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: jest.fn(() => ({ execSync: jest.fn(), getFirstSync: jest.fn(), getAllSync: jest.fn(), prepareSync: jest.fn(), closeSync: jest.fn() }))
}));

jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));

import DatabaseManager from '../src/data/database';

// Mock DB to simulate prepareSync throwing / getAllSync fallback
describe('Database neighbor fallback', () => {
  it('falls back to safeGetAllSync when prepared spatial query fails', async () => {
    // Create a fake db that will throw on getFirstSync/prepareSync but return a simple array for getAllSync
    const fakeDb: any = {
      getFirstSync: jest.fn(() => ({ geometry: JSON.stringify({ type: 'Polygon', coordinates: [[[0,0],[1,0],[1,1],[0,1]]] }) })),
      // Simulate prepareSync throwing for spatial queries
      prepareSync: jest.fn(() => { throw new Error('prepareSync failed'); }),
      getAllSync: jest.fn((sql: string, params?: any[]) => {
        // Return fallback neighbors for the last-resort query
        if (sql && sql.includes('SELECT * FROM parcels WHERE num_parcel !=')) {
          return [{ num_parcel: 'P-1' }, { num_parcel: 'P-2' }];
        }
        return [];
      }),
      execSync: jest.fn()
    };

    // Temporarily replace the DatabaseManager instance's db
    const origDb = (DatabaseManager as any).db;
    (DatabaseManager as any).db = fakeDb;

      try {
        const neighbors = await (DatabaseManager as any).getNeighborParcels('TEST');
        expect(Array.isArray(neighbors)).toBe(true);
        // New behavior: when we cannot compute reliable distances for the
        // target parcel, the function returns fallback candidate rows with
        // null distance metadata so the UI can still show nearby parcels.
        expect(neighbors.length).toBe(2);
        // ensure fallback rows have distance metadata set to null/false
        expect(neighbors[0].__neighbor_distance_m).toBeNull();
        expect(neighbors[0].__neighbor_within_1km).toBe(false);
      } finally {
      // restore original db
      (DatabaseManager as any).db = origDb;
    }
  });
});
