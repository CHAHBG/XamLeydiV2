import * as SQLite from 'expo-sqlite';
// @ts-ignore
import ParcelsIndividuels from './Parcels_individuels.json';
// @ts-ignore
import ParcelsCollectives from './Parcels_collectives.json';

type SQLiteDatabase = ReturnType<typeof SQLite.openDatabaseSync>;

interface ParcelFeature {
  properties?: {
    Num_parcel?: string;
    Typ_pers?: string;
    Prenom?: string;
    Nom?: string;
    Prenom_M?: string;
    Nom_M?: string;
    Denominat?: string;
    Village?: string;
  };
  geometry?: any;
}

class DatabaseManager {
  db: SQLiteDatabase | null = null;

  async initializeDatabase() {
    if (typeof SQLite.openDatabaseSync !== 'function') {
      console.error('expo-sqlite is not available. Are you running in Expo Go?');
      throw new Error('expo-sqlite is not available. Please use a development build.');
    }
    try {
      this.db = SQLite.openDatabaseSync('parcelapp.db');
      await this.createTables();
      await this.seedData();
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Failed to open database:', error);
      throw error;
    }
  }

  async createTables() {
    if (!this.db) throw new Error('Database not initialized');
    
    try {
      this.db.execSync(
        `CREATE TABLE IF NOT EXISTS parcels (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          num_parcel TEXT,
          parcel_type TEXT,
          typ_pers TEXT,
          prenom TEXT,
          nom TEXT,
          prenom_m TEXT,
          nom_m TEXT,
          denominat TEXT,
          village TEXT,
          geometry TEXT,
          properties TEXT
        );`
      );
    } catch (error) {
      console.error('Error creating tables:', error);
      throw error;
    }
  }

  async seedData() {
    if (!this.db) return;
    
    try {
      // Check if already seeded
      const countResult = this.db.getFirstSync('SELECT COUNT(*) as count FROM parcels');
      const count = (countResult as { count: number })?.count || 0;
      
      if (count > 0) {
        console.log('Database already seeded');
        return;
      }

      console.log('Seeding database...');
      
      // Prepare insert statement
      const insertStatement = this.db.prepareSync(
        `INSERT INTO parcels (num_parcel, parcel_type, typ_pers, prenom, nom, prenom_m, nom_m, denominat, village, geometry, properties)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );

      // Insert individual parcels
      const individuels = Array.isArray(ParcelsIndividuels) ? ParcelsIndividuels : [];
      for (const feature of individuels as ParcelFeature[]) {
        try {
          insertStatement.executeSync([
            feature.properties?.Num_parcel || null,
            'individuel',
            feature.properties?.Typ_pers || null,
            feature.properties?.Prenom || null,
            feature.properties?.Nom || null,
            null, // prenom_m
            null, // nom_m
            feature.properties?.Denominat || null,
            feature.properties?.Village || null,
            JSON.stringify(feature.geometry),
            JSON.stringify(feature.properties)
          ]);
        } catch (error) {
          console.error('Error inserting individual parcel:', error);
        }
      }

      // Insert collective parcels
      const collectifs = Array.isArray(ParcelsCollectives) ? ParcelsCollectives : [];
      for (const feature of collectifs as ParcelFeature[]) {
        try {
          insertStatement.executeSync([
            feature.properties?.Num_parcel || null,
            'collectif',
            feature.properties?.Typ_pers || null,
            null, // prenom
            null, // nom
            feature.properties?.Prenom_M || null,
            feature.properties?.Nom_M || null,
            feature.properties?.Denominat || null,
            feature.properties?.Village || null,
            JSON.stringify(feature.geometry),
            JSON.stringify(feature.properties)
          ]);
        } catch (error) {
          console.error('Error inserting collective parcel:', error);
        }
      }

      // Finalize the prepared statement
      insertStatement.finalizeSync();
      
      console.log(`Seeded ${individuels.length} individual and ${collectifs.length} collective parcels`);
      
    } catch (error) {
      console.error('Error seeding data:', error);
      throw error;
    }
  }

  async searchParcels(query: string): Promise<any[]> {
    if (!this.db) {
      throw new Error('Database is not initialized.');
    }

    try {
      const searchQuery = `%${query}%`;
      const results = this.db.getAllSync(
        'SELECT * FROM parcels WHERE num_parcel LIKE ? OR nom LIKE ? OR prenom LIKE ? OR prenom_m LIKE ? OR nom_m LIKE ? OR denominat LIKE ?',
        [searchQuery, searchQuery, searchQuery, searchQuery, searchQuery, searchQuery]
      );
      
      return results || [];
    } catch (error) {
      console.error('Error searching parcels:', error);
      throw error;
    }
  }

  async getParcelById(id: number): Promise<any | null> {
    if (!this.db) {
      throw new Error('Database is not initialized.');
    }

    try {
      const result = this.db.getFirstSync('SELECT * FROM parcels WHERE id = ?', [id]);
      return result || null;
    } catch (error) {
      console.error('Error getting parcel by id:', error);
      throw error;
    }
  }

  async getAllParcels(): Promise<any[]> {
    if (!this.db) {
      throw new Error('Database is not initialized.');
    }

    try {
      const results = this.db.getAllSync('SELECT * FROM parcels');
      return results || [];
    } catch (error) {
      console.error('Error getting all parcels:', error);
      throw error;
    }
  }

  async getParcelsByType(type: 'individuel' | 'collectif'): Promise<any[]> {
    if (!this.db) {
      throw new Error('Database is not initialized.');
    }

    try {
      const results = this.db.getAllSync('SELECT * FROM parcels WHERE parcel_type = ?', [type]);
      return results || [];
    } catch (error) {
      console.error('Error getting parcels by type:', error);
      throw error;
    }
  }

  async getParcelsByVillage(village: string): Promise<any[]> {
    if (!this.db) {
      throw new Error('Database is not initialized.');
    }

    try {
      const results = this.db.getAllSync('SELECT * FROM parcels WHERE village = ?', [village]);
      return results || [];
    } catch (error) {
      console.error('Error getting parcels by village:', error);
      throw error;
    }
  }

  // Get database statistics
  async getStats(): Promise<{
    totalParcels: number;
    individualParcels: number;
    collectiveParcels: number;
    villages: string[];
  }> {
    if (!this.db) {
      throw new Error('Database is not initialized.');
    }

    try {
      const totalResult = this.db.getFirstSync('SELECT COUNT(*) as count FROM parcels');
      const individualResult = this.db.getFirstSync("SELECT COUNT(*) as count FROM parcels WHERE parcel_type = 'individuel'");
      const collectiveResult = this.db.getFirstSync("SELECT COUNT(*) as count FROM parcels WHERE parcel_type = 'collectif'");
      const villagesResult = this.db.getAllSync('SELECT DISTINCT village FROM parcels WHERE village IS NOT NULL ORDER BY village');

      return {
        totalParcels: (totalResult as { count: number })?.count || 0,
        individualParcels: (individualResult as { count: number })?.count || 0,
        collectiveParcels: (collectiveResult as { count: number })?.count || 0,
        villages: villagesResult?.map((row: any) => row.village) || []
      };
    } catch (error) {
      console.error('Error getting stats:', error);
      throw error;
    }
  }
}

export default new DatabaseManager();