import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';
import { Platform } from 'react-native';

// Tunable constants for neighbor queries and caching
const DEFAULT_NEIGHBOR_LIMIT = 6; // number of neighbor parcels to return per query
const NEIGHBOR_CACHE_TTL_MS = 2 * 60 * 1000; // cache TTL for neighbor queries (2 minutes)

type SQLiteDatabase = ReturnType<typeof SQLite.openDatabaseSync>;

interface ParcelFeature {
  properties?: { [k: string]: any };
  geometry?: any;
}

// Create a singleton database manager to avoid multiple instances
let instance: DatabaseManager | null = null;

class DatabaseManager {
  db: SQLiteDatabase | null = null;
  seedingProgress: { inserted: number; total: number } | null = null;
  private seedingListeners: Set<(p: { inserted: number; total: number } | null) => void> = new Set();
  private preparedStatements: Map<string, any> = new Map();
  private queryCache: Map<string, { timestamp: number, result: any }> = new Map();
  
  static getInstance(): DatabaseManager {
    if (!instance) {
      instance = new DatabaseManager();
    }
    return instance;
  }

  addSeedingListener(fn: (p: { inserted: number; total: number } | null) => void) {
    this.seedingListeners.add(fn);
  }
  removeSeedingListener(fn: (p: { inserted: number; total: number } | null) => void) {
    this.seedingListeners.delete(fn);
  }
  private notifySeeding() {
    for (const l of this.seedingListeners) {
      try { l(this.seedingProgress); } catch (e) { /* ignore */ }
    }
  }

  // Helper method to seed basic test data
  async seedTestData() {
    if (!this.db) return;
    
    console.log("Seeding test data into database...");
    
    try {
      // Create parcels table if it doesn't exist
      this.db.execSync(`
        CREATE TABLE IF NOT EXISTS parcels (
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
        )
      `);
      
      // Check if the table already has data
      const countResult = this.safeGetFirstSync("SELECT COUNT(*) as count FROM parcels");
      const count = countResult ? (countResult as any).count : 0;
      
      if (count === 0) {
        console.log("Parcels table is empty, inserting test data");
        
        // Insert some test individual parcels
        this.db.execSync(`
          INSERT INTO parcels (num_parcel, parcel_type, typ_pers, prenom, nom, village, geometry, properties)
          VALUES 
            ('IND-001', 'individuel', 'personne physique', 'Mohamed', 'Diallo', 'Village A', '{}', '{"regionSenegal":"Dakar", "departmentSenegal":"Dakar", "communeSenegal":"Plateau"}'),
            ('IND-002', 'individuel', 'personne physique', 'Fatou', 'Sow', 'Village B', '{}', '{"regionSenegal":"Thiès", "departmentSenegal":"Thiès", "communeSenegal":"Thiès Ouest"}'),
            ('IND-003', 'individuel', 'personne physique', 'Amadou', 'Ba', 'Village C', '{}', '{"regionSenegal":"Saint-Louis", "departmentSenegal":"Saint-Louis", "communeSenegal":"Saint-Louis"}')
        `);
        
        // Insert some test collective parcels
        this.db.execSync(`
          INSERT INTO parcels (num_parcel, parcel_type, typ_pers, prenom_m, nom_m, denominat, village, geometry, properties)
          VALUES 
            ('COL-001', 'collectif', 'famille', 'Ibrahim', 'Ndiaye', 'Famille Ndiaye', 'Village D', '{}', 
            '{"Prenom_M":"Ibrahim", "Nom_M":"Ndiaye", "regionSenegal":"Ziguinchor", "departmentSenegal":"Ziguinchor", "communeSenegal":"Ziguinchor", "Cas_de_Personne_001":"Représentant", "Quel_est_le_nombre_d_affectata":"5", "Prenom_001":"Oumar", "Nom_001":"Ndiaye"}'),
            
            ('COL-002', 'collectif', 'association', 'Aissatou', 'Diop', 'Association des femmes', 'Village E', '{}',
            '{"Prenom_M":"Aissatou", "Nom_M":"Diop", "regionSenegal":"Louga", "departmentSenegal":"Louga", "communeSenegal":"Louga", "Cas_de_Personne_001":"Présidente", "Quel_est_le_nombre_d_affectata":"15", "Prenom_001":"Mariama", "Nom_001":"Fall"}')
        `);
        
        console.log("Test data inserted successfully");
      } else {
        console.log(`Parcels table already has ${count} rows, skipping test data insertion`);
      }
    } catch (e) {
      console.error("Error seeding test data:", e);
    }
  }

  async initializeDatabase(options?: { backgroundSeed?: boolean }) {
    const dbName = 'parcelapp.db';
    const sqliteDir = `${FileSystem.documentDirectory}SQLite`;
    const dbDest = `${sqliteDir}/${dbName}`;
    
    // Maximum number of initialization attempts
    const MAX_ATTEMPTS = 3;
    let attempts = 0;
    
    while (attempts < MAX_ATTEMPTS) {
      attempts++;
      try {
        // Ensure the SQLite directory exists
        try {
          const dirInfo = await FileSystem.getInfoAsync(sqliteDir);
          if (!dirInfo.exists) {
            await FileSystem.makeDirectoryAsync(sqliteDir, { intermediates: true });
          }
        } catch (dirError) {
          console.warn('Error creating SQLite directory:', dirError);
          // Try to continue anyway
        }
        
        // Check if the database exists, copy prebuilt if not
        try {
          const info = await FileSystem.getInfoAsync(dbDest);
          if (!info.exists) {
            try {
              // Try to copy bundled DB using both approaches
              let copied = false;
              
              // First approach: Try using Asset to load the prebuilt database
              try {
                console.log("Attempting to load prebuilt DB with Asset API...");
                const assetPath = require('../../prebuilt/parcelapp.db');
                const asset = Asset.fromModule(assetPath);
                await asset.downloadAsync().catch((e) => console.log("Asset download error:", e));
                const source = asset.localUri || asset.uri;
                
                if (source) {
                  console.log("Asset found, copying from:", source);
                  await FileSystem.copyAsync({ from: source, to: dbDest })
                    .catch((e) => console.warn('Prebuilt DB copy failed (Asset method):', e));
                  
                  const verifyInfo = await FileSystem.getInfoAsync(dbDest);
                  if (verifyInfo.exists && verifyInfo.size > 0) {
                    console.log("Database copied successfully via Asset API");
                    console.log(`Bundled DB size: ${verifyInfo.size} bytes`);
                    copied = true;
                  }
                }
              } catch (assetError) {
                console.warn('Asset approach failed:', assetError);
              }
              
              // Second approach: Try direct filesystem if available
              if (!copied && FileSystem.documentDirectory) {
                try {
                  console.log("Attempting to copy prebuilt DB from bundle assets...");
                  // For Android, try to find it in the bundled assets
                  if (Platform.OS === 'android') {
                    const bundledDbPath = `${FileSystem.bundleDirectory}prebuilt/parcelapp.db`;
                    const bundleInfo = await FileSystem.getInfoAsync(bundledDbPath);
                    
                    if (bundleInfo.exists) {
                      console.log("Found DB in bundle at:", bundledDbPath);
                      await FileSystem.copyAsync({ from: bundledDbPath, to: dbDest });
                      
                      const verifyInfo = await FileSystem.getInfoAsync(dbDest);
                      if (verifyInfo.exists && verifyInfo.size > 0) {
                        console.log("Database copied successfully from bundle");
                        console.log(`Bundled DB size: ${verifyInfo.size} bytes`);
                        copied = true;
                      }
                    }
                  }
                } catch (fsError) {
                  console.warn('Filesystem approach failed:', fsError);
                }
              }
              
              if (!copied) {
                console.warn('No prebuilt DB could be copied');
              }
            } catch (e) {
              console.warn('Error during prebuilt DB copy:', e);
              // Continue to create empty database
            }
          }
        } catch (e) {
          console.warn('Error checking database file:', e);
        }

        // Safely open database with error handling
        if (this.db) {
          try {
            this.db.closeSync();
          } catch (closeErr) {
            // Ignore close errors
          }
          this.db = null;
        }
        
        this.db = SQLite.openDatabaseSync(dbName);
        
        // Verify database connection
        if (!this.db) {
          throw new Error('Database connection is null after opening');
        }
        
        // Verify database has the necessary tables
        let hasParcelTable = false;
        try {
          const result = this.safeGetFirstSync(
            "SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='parcels'"
          );
          hasParcelTable = result ? ((result as any).count > 0) : false;
          
          if (!hasParcelTable) {
            console.log("Database doesn't have parcels table - may need seeding");
            // The seeding will happen later in the initialization process if needed
          }
        } catch (schemaErr) {
          console.warn('Schema check failed:', schemaErr);
          // Will continue to regular validation
        }
        
        // Verify database is functioning by executing a simple query
        try {
          // execSync may not return a value in some runtime shims; rely on try/catch
          // to detect failures instead of checking a return value.
          this.db.execSync("SELECT 1");
          
          // Create tables
          await this.createTables();
          
          // Check if the database has data already
          const countResult = this.safeGetFirstSync("SELECT COUNT(*) as count FROM parcels");
          const count = countResult ? (countResult as any).count : 0;

          // In development, if the DB only contains a very small number of rows
          // (likely the hardcoded test data), force a reload from JSON so the
          // app sees the real dataset without manual intervention.
          const isDev = (typeof __DEV__ !== 'undefined' && (__DEV__ as any) === true);
          const devSmallCount = isDev && count > 0 && count < 100;

          if (count === 0 || devSmallCount) {
            if (devSmallCount) console.log('Development: small parcel count detected, forcing JSON reseed...');

            try {
              // Force reloading from JSON when requested - this will clear existing records
              // when forceReload=true in seedData
              await this.seedData(true);

              // Verify data was loaded
              const verifyCount = this.safeGetFirstSync("SELECT COUNT(*) as count FROM parcels");
              const verifiedCount = verifyCount ? (verifyCount as any).count : 0;

              if (verifiedCount === 0) {
                console.log("Real data seeding failed to produce records, falling back to test data");
                await this.seedTestData();
              } else {
                console.log(`Successfully seeded database with ${verifiedCount} records from JSON files`);
              }
            } catch (seedError) {
              console.error("Error seeding real data:", seedError);
              console.log("Falling back to test data");
              await this.seedTestData();
            }
          } else {
            console.log(`Database already has ${count} records, skipping seeding`);
          }
          
        } catch (testError) {
          console.error('Database validation query failed:', testError);
          throw testError;
        }
        
        // If we got here, initialization was successful
        console.log('Database initialized successfully');
        return;
        
      } catch (e) {
        console.error(`Database initialization attempt ${attempts} failed:`, e);
        
        // Close the DB if it was opened
        if (this.db) {
          try {
            this.db.closeSync();
          } catch (closeErr) {
            // Ignore close errors
          }
          this.db = null;
        }
        
        // If we've reached max attempts, throw the error
        if (attempts >= MAX_ATTEMPTS) {
          console.error('Max database initialization attempts reached, giving up');
          throw e;
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  async createTables() {
    if (!this.db) throw new Error('Database not initialized');
    this.db.execSync(`CREATE TABLE IF NOT EXISTS parcels (
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
    );`);

    this.db.execSync(`CREATE TABLE IF NOT EXISTS complaints (
      id TEXT PRIMARY KEY,
      parcel_number TEXT,
      created_at TEXT,
      data TEXT
    );`);
  }

  private stripDiacritics(s: string) {
    return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
  
  // Safe wrappers around synchronous sqlite calls to avoid uncaught native errors
  private safeGetFirstSync(sql: string, params?: any[]) {
    try {
      if (!this.db) {
        console.warn("Database not initialized in safeGetFirstSync");
        return null;
      }
      const p = params || [];
      console.log("Running SQL first query:", sql, "with params:", p);
      const result = this.db.getFirstSync(sql, ...p);
      console.log("First query result:", result);
      return result;
    } catch (e) {
      console.warn('safeGetFirstSync failed for SQL:', sql, e);
      return null;
    }
  }

  private safeGetAllSync(sql: string, params?: any[]) {
    try {
      if (!this.db) return [];
      const p = params || [];
      console.log("Running SQL query:", sql, "with params:", p);
      const result = this.db.getAllSync(sql, ...p) || [];
      console.log(`Query returned ${result.length} rows`);
      return result;
    } catch (e) {
      console.warn('safeGetAllSync failed for SQL:', sql, e);
      return [];
    }
  }

  private safeExecSync(sql: string) {
    try {
      if (!this.db) return null;
      return this.db.execSync(sql);
    } catch (e) {
      console.warn('safeExecSync failed for SQL:', sql, e);
      return null;
    }
  }

  // Fallback storage for complaints when native DB calls fail.
  private async readFallbackComplaintsFile(): Promise<any[]> {
    try {
      const path = `${FileSystem.documentDirectory}complaints_fallback.json`;
      const info = await FileSystem.getInfoAsync(path);
      if (!info.exists) return [];
      const s = await FileSystem.readAsStringAsync(path, { encoding: FileSystem.EncodingType.UTF8 });
      return JSON.parse(s || '[]');
    } catch (e) {
      console.warn('readFallbackComplaintsFile failed', e);
      return [];
    }
  }

  private async writeFallbackComplaintsFile(items: any[]): Promise<boolean> {
    try {
      const path = `${FileSystem.documentDirectory}complaints_fallback.json`;
      await FileSystem.writeAsStringAsync(path, JSON.stringify(items), { encoding: FileSystem.EncodingType.UTF8 });
      return true;
    } catch (e) {
      console.warn('writeFallbackComplaintsFile failed', e);
      return false;
    }
  }

  private async appendFallbackComplaintFile(item: any): Promise<boolean> {
    try {
      const arr = await this.readFallbackComplaintsFile();
      // keep newest first
      arr.unshift(item);
      await this.writeFallbackComplaintsFile(arr);
      return true;
    } catch (e) {
      console.warn('appendFallbackComplaintFile failed', e);
      return false;
    }
  }
  
  /**
   * Normalize parsed properties: keep original keys and add lowercase/ascii variants
   * so UI code can look up many legacy key names reliably.
   */
  private normalizeParsedProps(props: Record<string, any> | null): Record<string, any> {
    const normalized: Record<string, any> = {};
    const src = props || {};
    for (const rawKey of Object.keys(src)) {
      const val = src[rawKey];
      // include original key
      normalized[rawKey] = val;
      // lowercase variant
      const lower = String(rawKey).toLowerCase();
      if (!(lower in normalized)) normalized[lower] = val;
      // ascii/no-diacritics variant
      const ascii = this.stripDiacritics(String(rawKey)).toLowerCase();
      if (!(ascii in normalized)) normalized[ascii] = val;
      // also add a PascalCase/no-underscore variant for some common keys
      const pascal = String(rawKey).replace(/[_\-]/g, '');
      if (!(pascal in normalized)) normalized[pascal] = val;
    }
    
    // Add indexed prenom/nom zero-padded variants and canonical mappings for common keys
    const keys = Object.keys(normalized);
    for (const k of keys) {
      const v = normalized[k];
      const kl = String(k).toLowerCase();

      // Handle patterns like prenom_1, prenom_01, prenom_001 -> expose Prenom_001
      let m = kl.match(/prenom[_-]0*(\d+)$/i) || kl.match(/^prenom0*(\d+)$/i);
      if (m && m[1]) {
        const idx = Number(m[1]);
        if (!isNaN(idx) && idx > 0) {
          const padded = String(idx).padStart(3, '0');
          const keyName = `Prenom_${padded}`;
          if (!(keyName in normalized)) normalized[keyName] = v;
          const lowerKey = keyName.toLowerCase();
          if (!(lowerKey in normalized)) normalized[lowerKey] = v;
        }
      }

      // Same for Nom
      m = kl.match(/nom[_-]0*(\d+)$/i) || kl.match(/^nom0*(\d+)$/i);
      if (m && m[1]) {
        const idx = Number(m[1]);
        if (!isNaN(idx) && idx > 0) {
          const padded = String(idx).padStart(3, '0');
          const keyName = `Nom_${padded}`;
          if (!(keyName in normalized)) normalized[keyName] = v;
          const lowerKey = keyName.toLowerCase();
          if (!(lowerKey in normalized)) normalized[lowerKey] = v;
        }
      }

      // Map common regional keys to canonical names
      if (kl.includes('region') || kl.includes('région')) {
        if (!('regionSenegal' in normalized)) normalized['regionSenegal'] = v;
      }
      if (kl.includes('depart') || kl.includes('département') || kl.includes('department')) {
        if (!('departmentSenegal' in normalized)) normalized['departmentSenegal'] = v;
      }
      if (kl.includes('arrond') || kl.includes('arrondissement')) {
        if (!('arrondissementSenegal' in normalized)) normalized['arrondissementSenegal'] = v;
      }
      if (kl.includes('commune')) {
        if (!('communeSenegal' in normalized)) normalized['communeSenegal'] = v;
      }
      if (kl.includes('village')) {
        if (!('Village' in normalized)) normalized['Village'] = v;
      }
      if (kl.includes('grappe')) {
        if (!('grappeSenegal' in normalized)) normalized['grappeSenegal'] = v;
      }
      if (kl.includes('vocation')) {
        if (!('Vocation' in normalized)) normalized['Vocation'] = v;
      }
      if (kl.includes('type_usag') || kl.includes('type_usa') || kl.includes('typeusage') || kl.includes('usage')) {
        if (!('type_usag' in normalized)) normalized['type_usag'] = v;
      }
    }

    return normalized;
  }

  async seedData(forceReload = false) {
  if (!this.db) {
    console.error("Cannot seed data: database not initialized");
    return;
  }
  // If running on a native device, avoid attempting to load very large
  // JSON files in-process. This can crash the JS runtime or Metro. Prefer
  // using the prebuilt DB or repository import scripts to populate the
  // device database. Fall back to the small test dataset so the app stays
  // functional.
  try {
    if (Platform.OS === 'android' || Platform.OS === 'ios') {
      console.log('seedData: native platform detected, skipping large JSON import. Falling back to test data.');
      await this.seedTestData();
      return;
    }
  } catch (e) {
    console.warn('seedData: Platform check failed, proceeding with caution', e);
  }
  try {
    console.log("Checking if database needs seeding...");
    const countRow = this.safeGetFirstSync('SELECT COUNT(*) as count FROM parcels');
    const count = ((countRow as any) && (countRow as any).count) || 0;
    console.log(`Current record count in database: ${count}`);
    
    if (count > 0 && !forceReload) {
      console.log("Database already seeded, skipping. Use forceReload=true to reload data.");
      return;
    }
    
    if (forceReload && count > 0) {
      console.log("Force reloading data, clearing existing records...");
      this.db.execSync('DELETE FROM parcels');
      console.log("Existing records deleted");
    }
    
    console.log("Database is empty or force reload requested, starting data seeding...");

      let insertStatement: any = null;
      try {
        if (this.db) insertStatement = this.db.prepareSync(`INSERT INTO parcels (num_parcel, parcel_type, typ_pers, prenom, nom, prenom_m, nom_m, denominat, village, geometry, properties) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      } catch (prepErr) {
        console.warn('prepareSync failed for insertStatement during seeding, will use exec fallback:', prepErr);
        insertStatement = null;
      }

      let individuels: any[] = [];
      let collectifs: any[] = [];
      // Always try to load the JSON data files regardless of environment
      console.log("Attempting to load JSON data files...");

      try {
      // On native mobile runtimes (android / ios) importing very large JSON
      // files via require/import can crash Metro or the native JS runtime.
      // To be safe, skip direct JSON imports on native platforms and fall
      // back to the small test dataset. If you want the full dataset on a
      // device, copy `prebuilt/parcelapp.db` into the app bundle or use the
      // repository tooling to import the SQL into the prebuilt DB and then
      // ensure the app copies that DB into its documentDirectory.
      console.log('Platform.OS=', Platform?.OS);
      if (Platform.OS === 'android' || Platform.OS === 'ios') {
        console.log('Native runtime detected; skipping in-app JSON import to avoid crashes. Falling back to test data.');
        individuels = [];
        collectifs = [];
      } else {
        try {
          // Prefer synchronous require() which works reliably with Metro bundler for JSON.
          // Fall back to dynamic import() if require is unavailable for some runtimes.
          let modInd: any = null;
          try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            modInd = require('./Parcels_individuels.json');
          } catch (reqErr) {
            try {
              modInd = await import('./Parcels_individuels.json');
            } catch (impErr) {
              console.error('Both require() and import() failed for Parcels_individuels.json', reqErr, impErr);
              modInd = null;
            }
          }
          individuels = Array.isArray(modInd?.default) ? modInd.default : (Array.isArray(modInd) ? modInd : []);
          console.log(`Loaded ${individuels.length} individual parcels from JSON`);
        } catch (e) {
          console.error("Failed to load individual parcels:", e);
          individuels = [];
        }

        try {
          let modCol: any = null;
          try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            modCol = require('./Parcels_collectives.json');
          } catch (reqErr) {
            try {
              modCol = await import('./Parcels_collectives.json');
            } catch (impErr) {
              console.error('Both require() and import() failed for Parcels_collectives.json', reqErr, impErr);
              modCol = null;
            }
          }
          collectifs = Array.isArray(modCol?.default) ? modCol.default : (Array.isArray(modCol) ? modCol : []);
          console.log(`Loaded ${collectifs.length} collective parcels from JSON`);
        } catch (e) {
          console.error("Failed to load collective parcels:", e);
          collectifs = [];
        }
      }
      } catch (err) {
        console.error('Unexpected error while attempting JSON import block in seedData:', err);
        individuels = [];
        collectifs = [];
        console.warn('Falling back to test data due to JSON import error');
        await this.seedTestData();
      }
      // If both arrays are empty, something went wrong with importing
      if (individuels.length === 0 && collectifs.length === 0) {
        console.warn("No data loaded from JSON files or import skipped; falling back to hardcoded test data");
        // Add a small set of test data to ensure functionality
        await this.seedTestData();
      }

      this.seedingProgress = { inserted: 0, total: individuels.length + collectifs.length };
      this.notifySeeding();

      const batchSize = 200;

      const normalizeProps = (props: Record<string, any>) => {
        const normalized: Record<string, any> = {};
        for (const raw of Object.keys(props || {})) {
          const k = (raw || '').trim();
          const v = props[raw];
          normalized[k] = v;
          const lower = k.toLowerCase();
          if (!(lower in normalized)) normalized[lower] = v;
          const ascii = this.stripDiacritics(k).toLowerCase();
          if (!(ascii in normalized)) normalized[ascii] = v;

          const m = k.match(/(.*?)(?:_IND|_COL)$/i);
          if (m && m[1]) {
            const base = (m[1] || '').trim();
            if (!(base in normalized)) normalized[base] = v;
            const baseLower = base.toLowerCase();
            if (!(baseLower in normalized)) normalized[baseLower] = v;
            const baseAscii = this.stripDiacritics(base).toLowerCase();
            if (!(baseAscii in normalized)) normalized[baseAscii] = v;
          }
        }
        return normalized;
      };

      const pick = (normalized: Record<string, any>, names: string[]) => {
        for (const n of names) {
          if (n in normalized && normalized[n] != null) return normalized[n];
          const ln = n.toLowerCase();
          if (ln in normalized && normalized[ln] != null) return normalized[ln];
          const an = this.stripDiacritics(n).toLowerCase();
          if (an in normalized && normalized[an] != null) return normalized[an];
        }
        return null;
      };

      const doBatchInsert = async (items: ParcelFeature[], kind: 'individuel' | 'collectif') => {
        for (let i = 0; i < items.length; i += batchSize) {
          const slice = items.slice(i, i + batchSize);
          for (const feature of slice) {
            try {
              const props = (feature && (feature.properties as any)) || {};
              const n = normalizeProps(props);
              if (kind === 'individuel') {
                if (insertStatement && typeof insertStatement.executeSync === 'function') {
                  insertStatement.executeSync([
                    pick(n, ['Num_parcel', 'num_parcel']) || null,
                    'individuel',
                    pick(n, ['Typ_pers', 'typ_pers']) || null,
                    pick(n, ['Prenom', 'prenom']) || null,
                    pick(n, ['Nom', 'nom']) || null,
                    null,
                    null,
                    pick(n, ['Denominat', 'denominat']) || null,
                    pick(n, ['Village', 'village']) || null,
                    JSON.stringify(feature.geometry),
                    JSON.stringify(n),
                  ]);
                } else {
                  // fallback to execSync (best-effort, may be less efficient)
                  try {
                    this.db && this.db.execSync(`INSERT INTO parcels (num_parcel, parcel_type, typ_pers, prenom, nom, prenom_m, nom_m, denominat, village, geometry, properties) VALUES ("${(pick(n, ['Num_parcel', 'num_parcel']) || '')}", 'individuel', "${(pick(n, ['Typ_pers', 'typ_pers']) || '')}", "${(pick(n, ['Prenom', 'prenom']) || '')}", "${(pick(n, ['Nom', 'nom']) || '')}", NULL, NULL, "${(pick(n, ['Denominat', 'denominat']) || '')}", "${(pick(n, ['Village', 'village']) || '')}", '${JSON.stringify(feature.geometry)}', '${JSON.stringify(n)}')`);
                  } catch (e) {
                    // ignore fallback failures
                  }
                }
              } else {
                const prenomM = pick(n, ['Prenom_M', 'Prenom_M_COL', 'Prenom_M_IND', 'prenom_m', 'prenom_m_col', 'prenom_m_ind', 'Prenom', 'prenom']) ?? null;
                const nomM = pick(n, ['Nom_M', 'Nom_M_COL', 'Nom_M_IND', 'nom_m', 'nom_m_col', 'nom_m_ind', 'Nom', 'nom']) ?? null;
                if (insertStatement && typeof insertStatement.executeSync === 'function') {
                  insertStatement.executeSync([
                    pick(n, ['Num_parcel', 'num_parcel']) || null,
                    'collectif',
                    pick(n, ['Typ_pers', 'typ_pers']) || null,
                    null,
                    null,
                    prenomM,
                    nomM,
                    pick(n, ['Denominat', 'denominat']) || null,
                    pick(n, ['Village', 'village']) || null,
                    JSON.stringify(feature.geometry),
                    JSON.stringify(n),
                  ]);
                } else {
                  try {
                    this.db && this.db.execSync(`INSERT INTO parcels (num_parcel, parcel_type, typ_pers, prenom, nom, prenom_m, nom_m, denominat, village, geometry, properties) VALUES ("${(pick(n, ['Num_parcel', 'num_parcel']) || '')}", 'collectif', "${(pick(n, ['Typ_pers', 'typ_pers']) || '')}", NULL, NULL, "${(prenomM || '')}", "${(nomM || '')}", "${(pick(n, ['Denominat', 'denominat']) || '')}", "${(pick(n, ['Village', 'village']) || '')}", '${JSON.stringify(feature.geometry)}', '${JSON.stringify(n)}')`);
                  } catch (e) {
                    // ignore fallback failures
                  }
                }
              }
              this.seedingProgress!.inserted += 1;
              this.notifySeeding();
            } catch (e) {
              console.error('insert error', e);
            }
          }
          await new Promise((r) => setTimeout(r, 8));
        }
      };

      await doBatchInsert(individuels as ParcelFeature[], 'individuel');
      await doBatchInsert(collectifs as ParcelFeature[], 'collectif');

      if (insertStatement && typeof insertStatement.finalizeSync === 'function') {
        try { insertStatement.finalizeSync(); } catch (e) { /* ignore finalize errors */ }
      }
      this.seedingProgress = null;
      this.notifySeeding();
    } catch (e) {
      console.error('seedData error', e);
      throw e;
    }
  }

  async searchParcels(query: string, options?: { limit?: number; offset?: number }): Promise<{ rows: any[]; total: number }> {
    console.log(`Search request: "${query}" with options:`, JSON.stringify(options));
    
    // Ensure query is defined and trimmed
    const cleanQuery = (query || '').trim();
    if (!cleanQuery) {
      console.log('Empty query, returning empty results');
      return { rows: [], total: 0 };
    }
    
    if (!this.db) {
      console.error("Database not initialized during search");
      // Attempt to initialize the database if it's not ready
      try {
        await this.initializeDatabase();
        console.log("Database initialized during search");
        if (!this.db) {
          console.error("Database still not initialized after attempt");
          return { rows: [], total: 0 };
        }
      } catch (e) {
        console.error("Failed to initialize database during search", e);
        return { rows: [], total: 0 };
      }
    }
    
    // Log database stats
    try {
      const count = this.safeGetFirstSync("SELECT COUNT(*) as count FROM parcels");
      console.log(`Database contains ${(count as any)?.count || 0} parcels total`);
    } catch (e) {
      console.error("Error checking parcel count:", e);
    }
    
    // Special case for searching exact IDs like 1312010205587
    const isExactIdSearch = /^\d+$/.test(cleanQuery) && cleanQuery.length >= 10;
    
    if (isExactIdSearch) {
      console.log(`Detected exact ID search for: ${cleanQuery}`);
      
      // Helper to parse and normalize a single DB row into the shape returned by
      // the regular search flow (parse properties JSON, normalize keys, merge).
      const processRow = (r: any) => {
        const row: any = { ...r };
        let parsedProps: Record<string, any> = {};
        try {
          if (row.properties && typeof row.properties === 'string') {
            parsedProps = JSON.parse(row.properties || '{}');
          } else if (row.properties && typeof row.properties === 'object') {
            parsedProps = row.properties;
          }
        } catch (e) {
          if (typeof console !== 'undefined' && (global as any).__DEV__) console.warn('Failed to parse properties for parcel row', row.num_parcel, e);
          parsedProps = {};
        }

        const normalizedProps = this.normalizeParsedProps(parsedProps);
        row.properties = normalizedProps;

        for (const k of Object.keys(normalizedProps || {})) {
          if (k === 'id' || k === 'geometry' || k === 'properties') continue;
          if (row[k] === undefined || row[k] === null || row[k] === '') {
            row[k] = normalizedProps[k];
          }
        }

        const collectiveKeys = [
          'Prenom_M','Nom_M','Cas_de_Personne_001','Quel_est_le_nombre_d_affectata',
          ...Array.from({ length: 27 }, (_, i) => `Prenom_${String(i+1).padStart(3,'0')}`),
          ...Array.from({ length: 27 }, (_, i) => `Nom_${String(i+1).padStart(3,'0')}`),
          'grappeSenegal','regionSenegal','departmentSenegal','arrondissementSenegal','communeSenegal','Village','Of','Enqueteur'
        ];
        for (const k of collectiveKeys) {
          if (!(k in row.properties)) row.properties[k] = null;
          if (row[k] === undefined) row[k] = row.properties[k];
        }

        return row;
      };

      // Try multiple exact match methods for thoroughness
      try {
        // 1. Direct exact match with specific ID
        console.log(`Trying exact match for ${cleanQuery} with = operator`);
        let exactMatch: any = this.safeGetFirstSync(
          "SELECT * FROM parcels WHERE num_parcel = ?", 
          [cleanQuery]
        );

        // Some sqlite runtime shims return unexpected shapes for getFirstSync
        // (for example returning a count-like object). If we don't have a
        // proper row with an `id` property, try safeGetAllSync and take the
        // first element as a fallback.
        if (exactMatch && (exactMatch as any).id == null) {
          const arr = this.safeGetAllSync("SELECT * FROM parcels WHERE num_parcel = ?", [cleanQuery]) || [];
          exactMatch = arr[0] || null;
        }

        if (exactMatch) {
          console.log(`✅ FOUND EXACT MATCH for ${cleanQuery} with ID ${(exactMatch as any).id}`);
          return { 
            rows: [processRow(exactMatch)], 
            total: 1 
          };
        } else {
          console.log(`❌ No exact match found with = operator for ${cleanQuery}`);
        }
        
        // 2. Try LIKE with exact match pattern
        console.log(`Trying LIKE match for ${cleanQuery}`);
        let likeMatch: any = this.safeGetFirstSync(
          "SELECT * FROM parcels WHERE num_parcel LIKE ?", 
          [cleanQuery]
        );
        if (likeMatch && (likeMatch as any).id == null) {
          const arr = this.safeGetAllSync("SELECT * FROM parcels WHERE num_parcel LIKE ?", [cleanQuery]) || [];
          likeMatch = arr[0] || null;
        }

        if (likeMatch) {
          console.log(`✅ FOUND LIKE MATCH for ${cleanQuery} with ID ${(likeMatch as any).id}`);
          return { 
            rows: [processRow(likeMatch)], 
            total: 1 
          };
        } else {
          console.log(`❌ No LIKE match found for ${cleanQuery}`);
        }
        
        // 3. Try searching in properties JSON for the ID
        console.log(`Trying properties JSON search for ${cleanQuery}`);
        let jsonMatch: any = this.safeGetFirstSync(
          "SELECT * FROM parcels WHERE properties LIKE ?", 
          [`%${cleanQuery}%`]
        );
        if (jsonMatch && (jsonMatch as any).id == null) {
          const arr = this.safeGetAllSync("SELECT * FROM parcels WHERE properties LIKE ?", [`%${cleanQuery}%`]) || [];
          jsonMatch = arr[0] || null;
        }

        if (jsonMatch) {
          console.log(`✅ FOUND IN JSON for ${cleanQuery} with ID ${(jsonMatch as any).id}`);
          return { 
            rows: [processRow(jsonMatch)], 
            total: 1 
          };
        } else {
          console.log(`❌ No match found in properties JSON for ${cleanQuery}`);
        }
        
        // If no match found after all direct attempts, try to import it
        try {
          console.log(`Attempting to import specific parcel: ${cleanQuery}`);
          
          // Try the direct insert function first
          try {
            const directInsert = require('./directInsert').default;
            if (typeof directInsert?.insertSpecificParcel === 'function') {
              console.log(`Attempting direct insert for ${cleanQuery}...`);
              const insertResult = await directInsert.insertSpecificParcel(cleanQuery);
              console.log(`Direct insert result for ${cleanQuery}:`, insertResult);
              
              if (insertResult) {
                // Try fetching the newly inserted parcel
                const newlyInserted = this.safeGetFirstSync(
                  "SELECT * FROM parcels WHERE num_parcel = ?", 
                  [cleanQuery]
                );
                
                if (newlyInserted) {
                  console.log(`✅ FOUND NEWLY INSERTED PARCEL for ${cleanQuery}`);
                  return { 
                    rows: [newlyInserted], 
                    total: 1 
                  };
                }
              }
            }
          } catch (directInsertErr) {
            console.log(`Direct insert failed: ${directInsertErr}`);
          }
          
          // Try the importSpecificParcel function
          try {
            const importer = require('./importSpecificParcel').default;
            if (typeof importer?.importSpecificParcel === 'function') {
              console.log(`Attempting import for ${cleanQuery}...`);
              const imported = await importer.importSpecificParcel(cleanQuery);
              console.log(`Import result for ${cleanQuery}:`, imported);
              
              if (imported) {
                // Try fetching the imported parcel
                const newlyImported = this.safeGetFirstSync(
                  "SELECT * FROM parcels WHERE num_parcel = ?", 
                  [cleanQuery]
                );
                
                if (newlyImported) {
                  console.log(`✅ FOUND NEWLY IMPORTED PARCEL for ${cleanQuery}`);
                  return { 
                    rows: [newlyImported], 
                    total: 1 
                  };
                }
              }
            }
          } catch (importErr) {
            console.log(`Import failed: ${importErr}`);
          }
        } catch (e) {
          console.log(`Error during import attempts: ${e}`);
        }
      } catch (e) {
        console.log(`Error during exact match search: ${e}`);
      }
    }
    
    // If we reach here, either it wasn't an exact ID search or we couldn't find/import the exact ID
    // Proceed with regular search
    try {
      const q = `%${cleanQuery}%`;
      const limit = options?.limit ?? 50;
      const offset = options?.offset ?? 0;
      
      console.log("Executing regular search query with pattern:", q);
      
      // Debug: Log all parcels for troubleshooting
      if (cleanQuery === '1312010205587') {
        try {
          console.log("SPECIAL DEBUGGING FOR 1312010205587");
          const allParcels = this.safeGetAllSync("SELECT id, num_parcel FROM parcels");
          console.log(`All parcels (${allParcels.length}):`, JSON.stringify(allParcels));
        } catch (e) {
          console.log("Error during debug logging:", e);
        }
      }
      
      // Enhanced search query prioritizing exact matches first
      // Put the exact match clause first for better performance
      const searchQuery = `
        SELECT COUNT(*) as total FROM parcels WHERE 
        num_parcel = ? OR
        num_parcel LIKE ? OR 
        nom LIKE ? OR 
        prenom LIKE ? OR 
        prenom_m LIKE ? OR 
        nom_m LIKE ? OR 
        denominat LIKE ? OR 
        village LIKE ? OR
        properties LIKE ?
      `;
      
      console.log("Executing count query with params:", cleanQuery);
      const countRow = this.safeGetFirstSync(
        searchQuery, 
        [cleanQuery, q, q, q, q, q, q, q, q]
      );
      
      const total = (countRow as { total: number })?.total || 0;
      console.log(`Count query found ${total} total matches`);
      
      if (total === 0) {
        return { rows: [], total: 0 };
      }
      
      // Enhanced search query prioritizing exact matches
      const selectQuery = `
        SELECT * FROM parcels WHERE 
        num_parcel = ? OR
        num_parcel LIKE ? OR 
        nom LIKE ? OR 
        prenom LIKE ? OR 
        prenom_m LIKE ? OR 
        nom_m LIKE ? OR 
        denominat LIKE ? OR
        village LIKE ? OR
        properties LIKE ? 
        ORDER BY 
          CASE WHEN num_parcel = ? THEN 0 ELSE 1 END,
          id 
        LIMIT ? OFFSET ?
      `;
      
      console.log("Executing select query with params:", cleanQuery, q, limit, offset);
      const rawRows: any[] = this.safeGetAllSync(
        selectQuery, 
        [cleanQuery, q, q, q, q, q, q, q, q, cleanQuery, limit, offset]
      ) || [];
      
      console.log(`Query returned ${rawRows.length} results`);
      
      // Log the first few results for debugging
      if (rawRows.length > 0) {
        console.log("First result:", 
          JSON.stringify({
            id: rawRows[0].id,
            num_parcel: rawRows[0].num_parcel,
            parcel_type: rawRows[0].parcel_type,
            nom: rawRows[0].nom,
            prenom: rawRows[0].prenom,
            nom_m: rawRows[0].nom_m,
            prenom_m: rawRows[0].prenom_m
          })
        );
      }

      // Parse properties JSON, normalize keys, and merge into top-level row; provide
      // a stable properties object even when parsing fails.
      const rows = rawRows.map((r: any) => {
        const row: any = { ...r };
        let parsedProps: Record<string, any> = {};
        try {
          if (row.properties && typeof row.properties === 'string') {
            parsedProps = JSON.parse(row.properties || '{}');
          } else if (row.properties && typeof row.properties === 'object') {
            parsedProps = row.properties;
          }
        } catch (e) {
          // If parsing fails, keep it as empty object and log in dev
          if (typeof console !== 'undefined' && (global as any).__DEV__) console.warn('Failed to parse properties for parcel row', row.num_parcel, e);
          parsedProps = {};
        }

  // Normalize parsedProps to include lowercase/ascii variants for lookups
  const normalizedProps = this.normalizeParsedProps(parsedProps);

        // Attach normalized properties back to row as an object
        row.properties = normalizedProps;

        // Merge keys from normalized properties into top-level row if not already present
        // (Do not overwrite critical DB columns like id, geometry, properties)
        for (const k of Object.keys(normalizedProps || {})) {
          if (k === 'id' || k === 'geometry' || k === 'properties') continue;
          if (row[k] === undefined || row[k] === null || row[k] === '') {
            row[k] = normalizedProps[k];
          }
        }

        // Ensure common collective keys exist (avoid undefined later in UI)
        const collectiveKeys = [
          'Prenom_M','Nom_M','Cas_de_Personne_001','Quel_est_le_nombre_d_affectata',
          // indexed affectataires
          ...Array.from({ length: 27 }, (_, i) => `Prenom_${String(i+1).padStart(3,'0')}`),
          ...Array.from({ length: 27 }, (_, i) => `Nom_${String(i+1).padStart(3,'0')}`),
          'grappeSenegal','regionSenegal','departmentSenegal','arrondissementSenegal','communeSenegal','Village','Of','Enqueteur'
        ];
        for (const k of collectiveKeys) {
          if (!(k in row.properties)) row.properties[k] = null;
          if (row[k] === undefined) row[k] = row.properties[k];
        }

        return row;
      });

      return { rows, total };
    } catch (e) {
      console.error('searchParcels error', e);
      throw e;
    }
  }

  async getParcelById(id: number) {
    if (!this.db) return null;
    try { return this.safeGetFirstSync('SELECT * FROM parcels WHERE id = ?', [id]) || null; } catch (e) { console.error(e); return null; }
  }

  async getParcelByNum(num: string) {
    if (!this.db) return null;
    try { return this.safeGetFirstSync('SELECT * FROM parcels WHERE num_parcel = ? LIMIT 1', [num]) || null; } catch (e) { console.error(e); return null; }
  }

  /**
   * Add a new complaint to the database with optimized error handling and validation
   * @param complaint The complaint object to add
   */
  async addComplaint(complaint: any) {
    // Ensure database is initialized
    if (!this.db) {
      console.warn('Database not initialized, attempting to initialize');
      try {
        await this.initializeDatabase();
      } catch (initError) {
        console.error('Failed to initialize database:', initError);
        throw new Error('Database initialization failed during complaint submission');
      }
      
      if (!this.db) {
        throw new Error('Database still not available after initialization attempt');
      }
    }
    
    try {
      // Validate required fields
      if (!complaint.id) {
        complaint.id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      }
      
      // Ensure complaints table exists
      try {
        this.db.execSync(`CREATE TABLE IF NOT EXISTS complaints (
          id TEXT PRIMARY KEY,
          parcel_number TEXT,
          created_at TEXT,
          data TEXT
        )`);
      } catch (tableError) {
        console.error('Error ensuring complaints table exists:', tableError);
        // Continue anyway, the table might already exist
      }
      
      // Use prepared statements with safer error handling
  let stmt: any;
      try {
        // Try to use prepared statement when available
        try {
          if (typeof this.db.prepareSync === 'function') {
            stmt = this.db.prepareSync(
              'INSERT OR REPLACE INTO complaints (id, parcel_number, created_at, data) VALUES (?, ?, ?, ?)'
            );
          }
        } catch (prepErr) {
          // prepareSync not supported in this runtime; fall back below
          stmt = null;
        }

        // Helper to escape SQL single quotes for exec fallback
        const escapeSql = (v: any) => {
          if (v === null || v === undefined) return 'NULL';
          const s = String(v);
          // double single quotes for SQL literal escaping
          return `'${s.replace(/'/g, "''")}'`;
        };

        if (stmt && typeof stmt.executeSync === 'function') {
          // Use prepared statement
          try {
            stmt.executeSync([
              complaint.id,
              complaint.parcelNumber || null,
              new Date().toISOString(),
              JSON.stringify(complaint),
            ]);
          } catch (stmtExecErr) {
            console.error('Prepared statement execute failed, falling back to file storage:', stmtExecErr);
            // Fallback to file-based complaints storage
            await this.appendFallbackComplaintFile({ id: complaint.id, parcelNumber: complaint.parcelNumber || null, created_at: new Date().toISOString(), ...complaint });
            return complaint.id;
          }
        } else {
          // Fallback: construct a safe SQL literal and use execSync
          try {
            const idVal = escapeSql(complaint.id);
            const parcelVal = complaint.parcelNumber ? escapeSql(complaint.parcelNumber) : 'NULL';
            const createdVal = escapeSql(new Date().toISOString());
            const dataVal = escapeSql(JSON.stringify(complaint));
            const sql = `INSERT OR REPLACE INTO complaints (id, parcel_number, created_at, data) VALUES (${idVal}, ${parcelVal}, ${createdVal}, ${dataVal})`;
            try {
              this.db.execSync(sql);
            } catch (execErr) {
              console.error('Fallback execSync insert failed, writing to fallback file instead:', execErr);
              await this.appendFallbackComplaintFile({ id: complaint.id, parcelNumber: complaint.parcelNumber || null, created_at: new Date().toISOString(), ...complaint });
              return complaint.id;
            }
          } catch (e) {
            console.error('Unexpected error preparing fallback insert, storing to fallback file:', e);
            await this.appendFallbackComplaintFile({ id: complaint.id, parcelNumber: complaint.parcelNumber || null, created_at: new Date().toISOString(), ...complaint });
            return complaint.id;
          }
        }
      } catch (stmtError) {
        console.error('Statement execution error:', stmtError);
        throw stmtError;
      } finally {
        // Always finalize statement in finally block when available
        if (stmt) {
          try {
            if (typeof stmt.finalizeSync === 'function') stmt.finalizeSync();
          } catch (finalizeError) {
            console.warn('Error finalizing statement:', finalizeError);
          }
        }
      }
      
      return complaint.id;
    } catch (e) { 
      console.error('addComplaint error:', e); 
      throw e; 
    }
  }

  /**
   * Export complaints with filtering options and optimized format handling
   * @param format The export format (csv or json)
   * @param options Filter options including startDate, endDate, commune
   * @returns Formatted string of complaints data
   */
  async exportComplaints(format: 'csv' | 'json', options?: any): Promise<string> {
    // If DB isn't available, fall back to file-based complaints store
    if (!this.db) {
      try {
        const items = await this.readFallbackComplaintsFile();
        if (format === 'json') return JSON.stringify(items, null, 2);
        if (!items.length) return '';
        const allKeys = new Set<string>();
        items.forEach((it: any) => Object.keys(it).forEach(k => allKeys.add(k)));
        const headerFields = Array.from(allKeys);
        const translations: Record<string, string> = {
          id: 'id', parcelNumber: 'numero_parcelle', date: 'date', activity: 'activite', commune: 'commune', complainantName: 'nom_plaignant', complainantSex: 'sexe_plaignant', complainantId: 'id_plaignant', complainantContact: 'contact_plaignant', complaintCategory: 'categorie_plainte', complaintDescription: 'description_plainte', complaintReason: 'raison_plainte', complaintReceptionMode: 'mode_reception', expectedResolution: 'resolution_attendue'
        };
        const headerLabels = headerFields.map(f => translations[f] || f);
        const headerLine = headerLabels.map(h => `"${String(h).replace(/"/g, '""')}"`).join(',');
        const csvRows = items.map((item: any) => headerFields.map(field => {
          const value = item[field] ?? '';
          return typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : `"${String(value)}"`;
        }).join(','));
        return [headerLine].concat(csvRows).join('\n');
      } catch (e) {
        console.error('exportComplaints fallback file error', e);
        return '';
      }
    }
    try {
      let query = 'SELECT * FROM complaints';
      const params: any[] = [];
      
      // Apply filters if provided
      const whereConditions: string[] = [];
      
      // If provided, compare only the date portion (YYYY-MM-DD) to avoid timezone/time granularity issues.
      // Use substr(created_at,1,10) which works for ISO timestamps like 2025-09-02T10:45:23.835Z
      if (options?.startDate) {
        const sd = String(options.startDate);
        whereConditions.push("substr(created_at,1,10) >= ?");
        params.push(sd);
      }

      if (options?.endDate) {
        const ed = String(options.endDate);
        whereConditions.push("substr(created_at,1,10) <= ?");
        params.push(ed);
      }

      if (options?.commune) {
        // Use case-insensitive LIKE matching to tolerate casing/whitespace/partial matches
        whereConditions.push("LOWER(json_extract(data, '$.commune')) LIKE ?");
        params.push(`%${String(options.commune).trim().toLowerCase()}%`);
      }
      
      if (whereConditions.length > 0) {
        query += ' WHERE ' + whereConditions.join(' AND ');
      }
      
      // Add sorting for consistent results
      query += ' ORDER BY created_at DESC';
      
      // Use prepared statement for better performance with filters
  // Try to prepare statement, but fall back to direct safeExecSync select when prepareSync is unavailable or throws
  let rows: any[] = [];
  try {
    const stmt: any = this.db.prepareSync ? this.db.prepareSync(query) : null;
    if (stmt) {
      // Some sqlite shims expect params as separate args; spread params array when calling.
      if (typeof console !== 'undefined' && (global as any).__DEV__) {
        try { console.debug('exportComplaints: query=', query, 'params=', params); } catch (e) { /* ignore */ }
      }
      try {
        rows = (typeof stmt.allSync === 'function') ? stmt.allSync(...(params || [])) : (stmt.getAllSync ? stmt.getAllSync(...(params || [])) : []);
      } catch (stmtErr) {
        console.warn('exportComplaints stmt.allSync error, falling back to safeGetAllSync:', stmtErr);
        rows = [];
      }
      // If stmt returned no rows, try the safeGetAllSync fallback which worked elsewhere
      if (!rows || (Array.isArray(rows) && rows.length === 0)) {
        try {
          rows = this.safeGetAllSync(query, params) || [];
        } catch (fbErr) {
          console.warn('exportComplaints safeGetAllSync fallback failed after empty stmt result:', fbErr);
          rows = [];
        }
      }
      if (typeof stmt.finalizeSync === 'function') stmt.finalizeSync();
    } else {
      // Fallback: use safeExecSync and parse results via a temporary statement if available
      try {
        rows = this.safeGetAllSync(query, params) || [];
      } catch (e) {
        console.warn('exportComplaints fallback select failed', e);
        rows = [];
      }
    }
  } catch (e) {
    console.warn('exportComplaints prepare/all failed, falling back:', e);
    rows = this.safeGetAllSync(query, params) || [];
  }

      
      
      // If SQL returned no rows but filters were requested, some sqlite runtimes may not support
      // json_extract or certain WHERE clauses; fall back to client-side filtering by selecting
      // all rows and applying filters in JS so the UI filters still work.
      if ((Array.isArray(rows) && rows.length === 0) && (options?.startDate || options?.endDate || options?.commune)) {
        if (typeof console !== 'undefined' && (global as any).__DEV__) console.debug('exportComplaints: SQL returned no rows for filtered query, falling back to client-side filter');
        try {
          const all = this.safeGetAllSync('SELECT * FROM complaints') || [];
          const filtered = all.filter((r: any) => {
            // parse created_at date (YYYY-MM-DD)
            const createdDate = (r && r.created_at) ? String(r.created_at).slice(0, 10) : '';
            if (options?.startDate && createdDate && createdDate < String(options.startDate)) return false;
            if (options?.endDate && createdDate && createdDate > String(options.endDate)) return false;
            if (options?.commune) {
              try {
                const parsed = r && r.data && typeof r.data === 'string' ? JSON.parse(r.data) : (r && r.data) || {};
                const comm = parsed && parsed.commune ? String(parsed.commune).toLowerCase().trim() : '';
                if (!comm.includes(String(options.commune).toLowerCase().trim())) return false;
              } catch (e) {
                return false;
              }
            }
            return true;
          });
          rows = filtered;
        } catch (fallbackErr) {
          console.warn('exportComplaints client-side filter fallback failed', fallbackErr);
          rows = [];
        }
      }

      // Process the results
      // Add DEV-only debug logs to inspect raw rows and parsing behavior across runtimes
      if (typeof console !== 'undefined' && (global as any).__DEV__) {
        try {
          console.debug('exportComplaints: raw rows count =', Array.isArray(rows) ? rows.length : typeof rows);
          if (Array.isArray(rows) && rows.length > 0) {
            // Print up to first 3 raw rows (avoid huge dumps)
            const sample = rows.slice(0, 3).map((rr: any) => {
              const d = rr && rr.data;
              return {
                id: rr && rr.id,
                parcel_number: rr && rr.parcel_number,
                created_at: rr && rr.created_at,
                dataType: d === null ? 'null' : typeof d,
                dataSample: (typeof d === 'string') ? (d.length > 200 ? d.slice(0, 200) + '... (truncated)' : d) : d,
              };
            });
            console.debug('exportComplaints: sample raw rows =', sample);
          }
        } catch (dbgErr) {
          console.warn('exportComplaints debug logging failed', dbgErr);
        }
      }

      const items = rows.map((r: any) => {
        try {
          // If data is already an object (some runtimes may return parsed objects), accept it
          if (r && r.data && typeof r.data !== 'string') return r.data;
          return JSON.parse(r.data);
        } catch (e) {
          if (typeof console !== 'undefined' && (global as any).__DEV__) {
            try {
              console.debug('exportComplaints: JSON.parse failed for row id=', r && r.id, 'raw data sample=', (r && r.data && typeof r.data === 'string') ? (r.data.length > 200 ? r.data.slice(0,200) + '... (truncated)' : r.data) : r && r.data, 'error=', e);
            } catch (inner) {
              // ignore
            }
          }
          return { id: r.id, parcelNumber: r.parcel_number, created_at: r.created_at };
        }
      });
      
      // Format output based on requested format
      if (format === 'json') {
        return JSON.stringify(items, null, 2);
      }
      
      // Optimize CSV generation for large datasets
      if (items.length === 0) return '';
      
      // Get all unique keys from all items for complete headers
      const allKeys = new Set<string>();
      items.forEach((item: any) => {
        Object.keys(item).forEach(k => allKeys.add(k));
      });

      // Preferred column ordering (if you want specific order, list keys here)
      const headerFields = Array.from(allKeys);

      // Map English keys to French labels for CSV headers (keep values as-is)
      const translations: Record<string, string> = {
        id: 'id',
        parcelNumber: 'numero_parcelle',
        date: 'date',
        activity: 'activite',
        commune: 'commune',
        complainantName: 'nom_plaignant',
        complainantSex: 'sexe_plaignant',
        complainantId: 'id_plaignant',
        complainantContact: 'contact_plaignant',
        complaintCategory: 'categorie_plainte',
        complaintDescription: 'description_plainte',
        complaintReason: 'raison_plainte',
        complaintReceptionMode: 'mode_reception',
        expectedResolution: 'resolution_attendue'
      };

      const headerLabels = headerFields.map(f => translations[f] || f);

      // Quote header labels for CSV safety
      const headerLine = headerLabels.map(h => `"${String(h).replace(/"/g, '""')}"`).join(',');

      // Generate CSV with consistent column ordering using headerFields for values
      const csvRows = items.map((item: any) => {
        return headerFields.map(field => {
          const raw = item[field];
          const value = (raw === null || raw === undefined) ? '' : String(raw);
          // Force all fields to be strings and escape double quotes by doubling them
          return `"${value.replace(/"/g, '""')}"`;
        }).join(',');
      });

      return [headerLine].concat(csvRows).join('\n');
    } catch (e) { 
      console.error('exportComplaints error', e); 
      throw e; 
    }
  }

  async importMissingCollectives(progressCb?: (count: number) => void): Promise<number> {
    if (!this.db) return 0;
    if (typeof progressCb === 'function') progressCb(0);
    return 0;
  }

  async getAllComplaints(): Promise<any[]> {
    // If DB missing, read fallback file
    if (!this.db) {
      try {
        const arr = await this.readFallbackComplaintsFile();
        return arr;
      } catch (e) {
        console.error('getAllComplaints fallback file error', e);
        return [];
      }
    }
    try {
      const rows = this.safeGetAllSync('SELECT * FROM complaints ORDER BY created_at DESC') || [];
      return rows.map((r: any) => {
        try {
          return JSON.parse(r.data);
        } catch (e) {
          return { id: r.id, parcelNumber: r.parcel_number, created_at: r.created_at };
        }
      });
    } catch (e) {
      console.error('getAllComplaints error', e);
      // Try fallback file
      try {
        const arr = await this.readFallbackComplaintsFile();
        return arr;
      } catch (e2) {
        console.error('getAllComplaints fallback file error', e2);
        return [];
      }
    }
  }

  async getComplaintsCount(): Promise<number> {
    if (!this.db) {
      try {
        const arr = await this.readFallbackComplaintsFile();
        return Array.isArray(arr) ? arr.length : 0;
      } catch (e) {
        console.error('getComplaintsCount fallback file error', e);
        return 0;
      }
    }
    try {
      const row = this.safeGetFirstSync('SELECT COUNT(*) as cnt FROM complaints') || { cnt: 0 };
      const cnt = (row && (row as any).cnt) ? (row as any).cnt : 0;
      return Number(cnt) || 0;
    } catch (e) {
      console.error('getComplaintsCount error', e);
      // fallback to file
      try {
        const arr = await this.readFallbackComplaintsFile();
        return Array.isArray(arr) ? arr.length : 0;
      } catch (e2) {
        console.error('getComplaintsCount fallback file error', e2);
        return 0;
      }
    }
  }

  async getAllParcels() { if (!this.db) throw new Error('Database is not initialized.'); return this.safeGetAllSync('SELECT * FROM parcels') || []; }

  async getParcelsByType(type: 'individuel' | 'collectif') { if (!this.db) throw new Error('Database is not initialized.'); return this.safeGetAllSync('SELECT * FROM parcels WHERE parcel_type = ?', [type]) || []; }

  async getParcelsByVillage(village: string) { 
    if (!this.db) throw new Error('Database is not initialized.'); 
    const cacheKey = `village_${village}`;
    const cached = this.queryCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < 60000)) {
      return cached.result;
    }
    
    const results = this.safeGetAllSync('SELECT * FROM parcels WHERE village = ?', [village]) || [];
    this.queryCache.set(cacheKey, { timestamp: Date.now(), result: results });
    return results;
  }

  async getNeighborParcels(parcelNum: string) {
    // Ensure DB is initialized before attempting queries. Try to initialize lazily if missing.
    if (!this.db) {
      try {
        // attempt to initialize database; this is safe if already initialized
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        await this.initializeDatabase();
      } catch (initErr) {
        console.warn('getNeighborParcels: initializeDatabase failed', initErr);
      }
    }
    if (!this.db) throw new Error('Database is not initialized.');
    if (!parcelNum) {
      console.warn('getNeighborParcels called with empty parcel number');
      return [];
    }
    
    // Use cache if available for improved performance
    const cacheKey = `neighbors_${parcelNum}`;
    const cached = this.queryCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < NEIGHBOR_CACHE_TTL_MS)) {
      return cached.result;
    }

    try {
  // Get the parcel geometry with added error handling (use safe wrapper)
  const parcel: any = this.safeGetFirstSync('SELECT geometry FROM parcels WHERE num_parcel = ?', [parcelNum]);
      if (!parcel) {
        console.warn(`Parcel with number ${parcelNum} not found`);
        return [];
      }
      
      if (!parcel.geometry) {
        console.warn(`Parcel with number ${parcelNum} has no geometry data`);
        return [];
      }
      
      // Parse geometry safely
      let geometry;
      try {
        geometry = JSON.parse(String(parcel.geometry));
        if (!geometry || !geometry.coordinates || !Array.isArray(geometry.coordinates)) {
          console.warn(`Invalid geometry format for parcel ${parcelNum}`);
          return [];
        }
      } catch (parseError) {
        console.error(`Failed to parse geometry for parcel ${parcelNum}:`, parseError);
        // Fall back to simpler neighbor search if geometry parsing fails
  const fallbackNeighbors = this.safeGetAllSync('SELECT * FROM parcels WHERE num_parcel != ? LIMIT 5', [parcelNum]) || [];
        this.queryCache.set(cacheKey, { timestamp: Date.now(), result: fallbackNeighbors });
        return fallbackNeighbors;
      }
      
  // Multi-step approach with fallbacks to improve reliability
  let neighbors: any[] = [];
      
      // First try with spatial query using JSON extraction
      try {
  neighbors = this.safeGetAllSync(`
          SELECT * FROM parcels 
          WHERE num_parcel != ? 
          AND json_extract(geometry, '$.coordinates[0][0][0]') BETWEEN 
            (SELECT json_extract(geometry, '$.coordinates[0][0][0]') FROM parcels WHERE num_parcel = ?) - 0.001 
            AND (SELECT json_extract(geometry, '$.coordinates[0][0][0]') FROM parcels WHERE num_parcel = ?) + 0.001
          AND json_extract(geometry, '$.coordinates[0][0][1]') BETWEEN
            (SELECT json_extract(geometry, '$.coordinates[0][0][1]') FROM parcels WHERE num_parcel = ?) - 0.001
            AND (SELECT json_extract(geometry, '$.coordinates[0][0][1]') FROM parcels WHERE num_parcel = ?) + 0.001
          LIMIT ${DEFAULT_NEIGHBOR_LIMIT}
        `, [parcelNum, parcelNum, parcelNum, parcelNum, parcelNum]);
        
        if (neighbors && neighbors.length > 0) {
          this.queryCache.set(cacheKey, { timestamp: Date.now(), result: neighbors });
          return neighbors;
        }
      } catch (spatialError) {
        console.warn('Spatial neighbor query failed, trying fallback method:', spatialError);
      }
      
      // Fallback to simpler method if spatial query returns no results
      try {
        // For polygon geometry, extract centroid coordinates for simpler proximity search
        let centroidLat = 0, centroidLng = 0;
        if (geometry.type === 'Polygon' && Array.isArray(geometry.coordinates[0])) {
          const coords = geometry.coordinates[0];
          coords.forEach((coord: number[]) => {
            centroidLng += coord[0];
            centroidLat += coord[1];
          });
          centroidLat /= coords.length;
          centroidLng /= coords.length;
          
          // Try a simpler bounding box query around the centroid
            neighbors = this.safeGetAllSync(`
            SELECT p.*, 
            (ABS(json_extract(p.geometry, '$.coordinates[0][0][0]') - ?) + 
             ABS(json_extract(p.geometry, '$.coordinates[0][0][1]') - ?)) as distance
            FROM parcels p
            WHERE p.num_parcel != ? 
            AND p.geometry IS NOT NULL
            ORDER BY distance ASC
            LIMIT ${DEFAULT_NEIGHBOR_LIMIT}
          `, [centroidLng, centroidLat, parcelNum]);
        }
      } catch (fallbackError) {
        console.warn('Fallback neighbor query failed:', fallbackError);
      }
      
      // Last resort fallback - just get some random parcels if all else fails
    if (!neighbors || neighbors.length === 0) {
  neighbors = this.safeGetAllSync(`SELECT * FROM parcels WHERE num_parcel != ? LIMIT ${DEFAULT_NEIGHBOR_LIMIT}`, [parcelNum]) || [];
      }
      
      this.queryCache.set(cacheKey, { timestamp: Date.now(), result: neighbors });
      return neighbors;
    } catch (e) {
      console.error('Error getting neighbor parcels:', e);
      return [];
    }
  }

  /**
   * Try to retrieve a parcel's geometry. If the stored geometry column is missing
   * or invalid, attempt to derive a usable geometry object from the properties blob.
   * Returns a GeoJSON-like object or null.
   */
  async getParcelGeometry(parcelNum: string): Promise<any | null> {
    if (!parcelNum) return null;
    if (!this.db) {
      try { await this.initializeDatabase(); } catch { /* ignore */ }
      if (!this.db) return null;
    }
    try {
      const row: any = this.safeGetFirstSync('SELECT geometry, properties FROM parcels WHERE num_parcel = ? LIMIT 1', [parcelNum]);
      if (!row) return null;
      const tryParseJSON = (raw: any) => {
        if (!raw) return null;
        if (typeof raw === 'object') return raw;
        if (typeof raw === 'string') {
          try { return JSON.parse(raw); } catch { return null; }
        }
        return null;
      };
      const isValidGeom = (g: any) => !!(g && (g.type === 'Polygon' || g.type === 'MultiPolygon') && g.coordinates && Array.isArray(g.coordinates));

      let geom = tryParseJSON(row.geometry);
      if (isValidGeom(geom)) return geom;

      // Derive from properties blob
      const props = tryParseJSON(row.properties);
      const extracted = this.extractGeometryFromProperties(props);
      if (isValidGeom(extracted)) return extracted;
      return null;
    } catch (e) {
      console.warn('getParcelGeometry failed', e);
      return null;
    }
  }

  /**
   * Attempt to extract a geometry object from a parsed properties object.
   * Looks for keys like geometry, geom, geojson or nested objects with a GeoJSON shape.
   */
  private extractGeometryFromProperties(props: any): any | null {
    if (!props || typeof props !== 'object') return null;
    const candidates: any[] = [];
    const pushIf = (v: any) => { if (v && typeof v === 'object') candidates.push(v); };
    for (const k of Object.keys(props)) {
      const lower = k.toLowerCase();
      if (['geometry','geom','geojson'].includes(lower)) {
        pushIf(typeof props[k] === 'string' ? (()=>{ try { return JSON.parse(props[k]); } catch { return null; } })() : props[k]);
      } else {
        const val = props[k];
        if (val && typeof val === 'object' && val.type && (val.coordinates || val.type === 'Feature')) {
          pushIf(val);
        }
      }
    }
    // If we encountered a Feature wrapper, unwrap
    const normalize = (g: any) => {
      if (!g) return null;
      if (g.type === 'Feature' && g.geometry) return g.geometry;
      return g;
    };
    for (const c of candidates) {
      const g = normalize(c);
      if (g && (g.type === 'Polygon' || g.type === 'MultiPolygon') && g.coordinates) return g;
    }
    // Try to detect a direct coordinates array (array of [lon,lat]) and wrap it
    if (Array.isArray((props as any).coordinates)) {
      const coords = (props as any).coordinates;
      if (Array.isArray(coords) && coords.length && Array.isArray(coords[0]) && typeof coords[0][0] === 'number') {
        return { type: 'Polygon', coordinates: [coords] };
      }
    }
    return null;
  }

  async getStats() {
    if (!this.db) throw new Error('Database is not initialized.');
    const cacheKey = 'stats';
    const cached = this.queryCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < 300000)) { // Cache for 5 minutes
      return cached.result;
    }
    
  const total = (this.safeGetFirstSync('SELECT COUNT(*) as count FROM parcels') as { count: number })?.count || 0;
  const indiv = (this.safeGetFirstSync("SELECT COUNT(*) as count FROM parcels WHERE parcel_type = 'individuel'") as { count: number })?.count || 0;
  const coll = (this.safeGetFirstSync("SELECT COUNT(*) as count FROM parcels WHERE parcel_type = 'collectif'") as { count: number })?.count || 0;
  const villages = (this.safeGetAllSync('SELECT DISTINCT village FROM parcels WHERE village IS NOT NULL ORDER BY village') || []).map((r: any) => r.village);
    
    const result = { totalParcels: total, individualParcels: indiv, collectiveParcels: coll, villages };
    this.queryCache.set(cacheKey, { timestamp: Date.now(), result });
    return result;
  }

  // Clear cache to free memory when needed
  clearCache() {
    this.queryCache.clear();
  }
  
  // Diagnostic function to check database status
  async getDiagnostics(): Promise<{ 
    isInitialized: boolean; 
    hasParcelTable: boolean; 
    rowCount: number; 
    sampleData: any[] | null;
  }> {
    const result = {
      isInitialized: !!this.db,
      hasParcelTable: false,
      rowCount: 0,
      sampleData: null as any[] | null
    };
    
    if (this.db) {
      try {
        const tableCheck = this.safeGetFirstSync("SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='parcels'");
        result.hasParcelTable = tableCheck ? ((tableCheck as any).count > 0) : false;
        
        if (result.hasParcelTable) {
          const countResult = this.safeGetFirstSync("SELECT COUNT(*) as count FROM parcels");
          result.rowCount = countResult ? (countResult as any).count : 0;
          
          if (result.rowCount > 0) {
            result.sampleData = this.safeGetAllSync("SELECT id, num_parcel, parcel_type, nom, prenom, nom_m, prenom_m, village FROM parcels LIMIT 5");
          }
        }
      } catch (e) {
        console.error("Error getting diagnostics:", e);
      }
    }
    
    return result;
  }
  
}

// Create and export singleton instance
const databaseManagerInstance = DatabaseManager.getInstance();
export default databaseManagerInstance;
export { DatabaseManager };