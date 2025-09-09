// Mock native Expo modules that database.ts imports
jest.mock('expo-sqlite', () => ({
  openDatabaseSync: jest.fn(() => ({
    exec: jest.fn(),
  })),
  openDatabase: jest.fn(() => ({
    transaction: jest.fn(),
  })),
}));
jest.mock('expo-file-system', () => ({}));
jest.mock('expo-asset', () => ({ Asset: { fromModule: () => ({ localUri: '' }) } }));

// Require database after mocks
import DatabaseManager, { DatabaseManager as DBClass } from '../src/data/database';

describe('DatabaseManager.searchParcels', () => {
  it('parses properties and includes Prenom_M, Nom_M, Cas_de_Personne_001 for collective parcel', async () => {
    // Create a fresh instance and mock the db
    const dm: any = DBClass.getInstance ? DBClass.getInstance() : DatabaseManager;

    // Mock database methods
    dm.db = {
      getFirstSync: jest.fn().mockReturnValue({ total: 1 }),
      getAllSync: jest.fn().mockReturnValue([
        {
          id: 123,
          num_parcel: '1312010205587',
          parcel_type: 'collectif',
          properties: JSON.stringify({
            Cas_de_Personne_001: 'Plusieurs_Personne_Physique',
            Prenom_M: 'FILY',
            Nom_M: 'BAMBARA',
            Quel_est_le_nombre_d_affectata: '7'
          })
        }
      ])
    };

  const res = await dm.searchParcels('1312010205587', { limit: 10, offset: 0 });
  expect(res.total).toBe(1);
  expect(res.rows).toHaveLength(1);
  const row = res.rows[0];
  expect(row.properties).toBeDefined();
  // normalized keys should be present
  expect(row.properties.Cas_de_Personne_001).toBe('Plusieurs_Personne_Physique');
  expect(row.properties.Prenom_M).toBe('FILY');
  expect(row.properties.Nom_M).toBe('BAMBARA');
  // ensure some indexed affectataire keys exist (should be null if not provided)
  expect(row.properties.Prenom_001).toBeDefined();
  expect(row.properties.Nom_001).toBeDefined();
  });
});
