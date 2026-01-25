import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';
import { Platform } from 'react-native';
// Optional Supabase client for remote sync
import { createClient, SupabaseClient } from '@supabase/supabase-js';

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
  private supabase: SupabaseClient | null = null;
  private retryIntervalId: any = null;
  seedingProgress: { inserted: number; total: number } | null = null;
  private seedingListeners: Set<(p: { inserted: number; total: number } | null) => void> = new Set();
  private preparedStatements: Map<string, any> = new Map();
  private queryCache: Map<string, { timestamp: number, result: any }> = new Map();
  // In-memory map to track sends in progress per remote id (or local id)
  private sendingMap: Map<string, boolean> = new Map();

  static getInstance(): DatabaseManager {
    if (!instance) {
      instance = new DatabaseManager();
    }
    return instance;
  }

  /**
   * Configure Supabase client for remote submission. Call this at app startup
   * with your Supabase URL and anon key. Does not throw on invalid input.
   */
  setSupabaseConfig(url: string | null | undefined, anonKey: string | null | undefined) {
    try {
      if (!url || !anonKey) {
        console.warn('setSupabaseConfig called with empty url or anonKey, supabase disabled');
        this.stopRetryScheduler();
        this.supabase = null;
        return;
      }
      this.supabase = createClient(url, anonKey);
      console.log('Supabase client initialized');
      // Start periodic retry for unsent complaints (every 60 seconds)
      try {
        if (this.retryIntervalId) clearInterval(this.retryIntervalId);
        this.retryIntervalId = setInterval(() => {
          try {
            this.retryUnsentComplaints().catch((e) => console.warn('retryUnsentComplaints error', e));
          } catch (e) {
            console.warn('Periodic retry threw', e);
          }
        }, 60 * 1000);
      } catch (e) {
        console.warn('Failed to schedule periodic retry', e);
      }
    } catch (e) {
      console.warn('Failed to initialize Supabase client', e);
      this.supabase = null;
    }
  }

  /**
   * Stop background retry if configured (call when disabling supabase)
   */
  private stopRetryScheduler() {
    try {
      if (this.retryIntervalId) {
        clearInterval(this.retryIntervalId);
        this.retryIntervalId = null;
      }
    } catch (e) { /* ignore */ }
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
            ('050-IND-001', 'individuel', 'personne physique', 'Mohamed', 'Diallo', 'Village A', '{}', '{"regionSenegal":"Dakar", "departmentSenegal":"Dakar", "communeSenegal":"Plateau"}'),
            ('050-IND-105', 'individuel', 'personne physique', 'Fatou', 'Sow', 'Village B', '{}', '{"regionSenegal":"Thiès", "departmentSenegal":"Thiès", "communeSenegal":"Thiès Ouest"}'),
            ('050-IND-205', 'individuel', 'personne physique', 'Amadou', 'Ba', 'Village C', '{}', '{"regionSenegal":"Saint-Louis", "departmentSenegal":"Saint-Louis", "communeSenegal":"Saint-Louis"}')
        `);

        // Insert some test collective parcels
        this.db.execSync(`
          INSERT INTO parcels (num_parcel, parcel_type, typ_pers, prenom_m, nom_m, denominat, village, geometry, properties)
          VALUES 
            ('050-COL-001', 'collectif', 'famille', 'Ibrahim', 'Ndiaye', 'Famille Ndiaye', 'Village D', '{}', 
            '{"Prenom_M":"Ibrahim", "Nom_M":"Ndiaye", "regionSenegal":"Ziguinchor", "departmentSenegal":"Ziguinchor", "communeSenegal":"Ziguinchor", "Cas_de_Personne_001":"Représentant", "Quel_est_le_nombre_d_affectata":"5", "Prenom_001":"Oumar", "Nom_001":"Ndiaye"}'),
            
            ('050-COL-205', 'collectif', 'association', 'Aissatou', 'Diop', 'Association des femmes', 'Village E', '{}',
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

        // Check if the database exists and compare with bundled version
        try {
          console.log('[DB DEBUG] Checking destination DB at', dbDest);
          console.log('[DB DEBUG] FileSystem.bundleDirectory=', FileSystem.bundleDirectory, 'documentDirectory=', FileSystem.documentDirectory);

          // Get info about destination DB
          const info = await FileSystem.getInfoAsync(dbDest);
          const dbSize = ('size' in info) ? (info as any).size : 0;
          console.log('[DB DEBUG] dbDest exists?', info.exists, ' size=', dbSize);

          // Get info about bundled DB to compare
          let bundledDbSize = 0;
          try {
            const assetPath = require('../../prebuilt/parcelapp.db');
            const asset = Asset.fromModule(assetPath);
            await asset.downloadAsync().catch(() => { });
            const source = asset.localUri || asset.uri;
            if (source) {
              const bundledInfo = await FileSystem.getInfoAsync(source);
              bundledDbSize = ('size' in bundledInfo) ? (bundledInfo as any).size : 0;
              console.log('[DB DEBUG] Bundled DB size:', bundledDbSize);
            }
          } catch (e) {
            console.warn('[DB DEBUG] Could not get bundled DB size:', e);
          }

          // Copy prebuilt DB if:
          // 1) File doesn't exist
          // 2) File is too small (< 1MB likely means empty schema only)
          // NOTE: Do NOT replace a valid existing DB just because its size
          // differs from the bundled DB. User data (complaints) will change the
          // DB size naturally and must never be wiped in production.
          const isDev = (typeof __DEV__ !== 'undefined' && (__DEV__ as any) === true);
          const needsCopy = !info.exists || dbSize < 1024 * 1024;

          // Dev-only escape hatch: allow replacing when bundled DB clearly changed.
          const devBundleDiffers = isDev && bundledDbSize > 0 && Math.abs(dbSize - bundledDbSize) > 1024;

          if (needsCopy || devBundleDiffers) {
            if (info.exists) {
              const reason = dbSize < 1024 * 1024
                ? 'too small (< 1MB)'
                : 'dev: different size from bundled version';
              console.log(`[DB DEBUG] Database exists but ${reason}, deleting and replacing with prebuilt DB`);
              console.log(`[DB DEBUG] Current DB: ${dbSize} bytes, Bundled DB: ${bundledDbSize} bytes`);
              try {
                await FileSystem.deleteAsync(dbDest, { idempotent: true });
                console.log('[DB DEBUG] Old database deleted successfully');
              } catch (delErr) {
                console.warn('[DB DEBUG] Failed to delete old database:', delErr);
              }
            }
            try {
              // Try to copy bundled DB using both approaches
              let copied = false;

              // First approach: Try using Asset to load the prebuilt database
              try {
                console.log("Attempting to load prebuilt DB with Asset API...");
                // Also write a small debug trace to documentDirectory so we can read it with run-as
                try {
                  const debugPath = `${FileSystem.documentDirectory}db_debug_paths.txt`;
                  const debugMsg = `[DB FILE DEBUG] Asset attempt: bundleDir=${FileSystem.bundleDirectory} docDir=${FileSystem.documentDirectory} dbDest=${dbDest}\n`;
                  await FileSystem.writeAsStringAsync(debugPath, debugMsg, { encoding: FileSystem.EncodingType.UTF8 }).catch(() => { });
                } catch (e) {
                  /* ignore debug-write failures */
                }
                const assetPath = require('../../prebuilt/parcelapp.db');
                console.log('[DB DEBUG] require() returned module id:', assetPath);
                const asset = Asset.fromModule(assetPath);
                console.log('[DB DEBUG] Asset:', asset);
                await asset.downloadAsync().catch((e) => console.log("Asset download error:", e));
                const source = asset.localUri || asset.uri;
                console.log('[DB DEBUG] Asset source URI/localUri:', source);

                if (source) {
                  console.log("Asset found, copying from:", source, ' to:', dbDest);
                  await FileSystem.copyAsync({ from: source, to: dbDest })
                    .catch((e) => console.warn('Prebuilt DB copy failed (Asset method):', e));

                  const verifyInfo = await FileSystem.getInfoAsync(dbDest);
                  console.log('[DB DEBUG] post-asset copy dbDest exists?', verifyInfo.exists, ' size=', ('size' in verifyInfo) ? (verifyInfo as any).size : 0);
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
                      console.log('[DB DEBUG] Attempting copy from bundledDbPath to dbDest');
                      await FileSystem.copyAsync({ from: bundledDbPath, to: dbDest });

                      const verifyInfo = await FileSystem.getInfoAsync(dbDest);
                      console.log('[DB DEBUG] post-bundle copy dbDest exists?', verifyInfo.exists, ' size=', ('size' in verifyInfo) ? (verifyInfo as any).size : 0);
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
                console.warn('No prebuilt DB could be copied - will use empty database with test data');
                try {
                  const debugPath = `${FileSystem.documentDirectory}db_debug_paths.txt`;
                  const debugMsg = `[DB FILE DEBUG] copy attempts failed for dbDest=${dbDest}\n`;
                  await FileSystem.writeAsStringAsync(debugPath, debugMsg, { encoding: FileSystem.EncodingType.UTF8 }).catch(() => { });
                } catch (e) { }
              }
            } catch (e) {
              console.warn('Error during prebuilt DB copy:', e);
              // Continue to create empty database
            }
          } else {
            console.log('[DB DEBUG] Database exists with valid size matching bundled version, skipping copy');
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

        // Immediately query the native sqlite database_list to discover the actual
        // file paths the native layer attached. Write them to a debug file so we
        // can inspect on-device with run-as even if logcat doesn't include JS logs.
        try {
          const dbList = this.safeGetAllSync("PRAGMA database_list;") || [];
          try {
            const debugPath = `${FileSystem.documentDirectory}db_debug_paths.txt`;
            const content = `[DB PRAGMA] ${new Date().toISOString()}\n` + JSON.stringify(dbList, null, 2) + '\n';
            await FileSystem.writeAsStringAsync(debugPath, content, { encoding: FileSystem.EncodingType.UTF8 }).catch(() => { });
          } catch (e) {
            // ignore write errors
          }
          try {
            // Also emit the attached database paths to JS console so logcat captures them.
            console.log('[DB PRAGMA]', JSON.stringify(dbList));
          } catch (e) {
            // ignore logging errors
          }
        } catch (e) {
          console.warn('Failed to read PRAGMA database_list for debug', e);
        }

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

          // Ensure parcels are refreshed from the bundled prebuilt DB when the app
          // ships a newer dataset. This preserves user complaints by only replacing
          // the parcels table.
          try {
            await this.maybeRefreshParcelsFromBundledDb();
          } catch (e) {
            console.warn('[DB] maybeRefreshParcelsFromBundledDb failed', e);
          }

          // Complaints schema migration: ensure backend_id column exists
          try {
            const cols = this.safeGetAllSync('PRAGMA table_info(complaints)') || [];
            const hasBackendId = Array.isArray(cols) && cols.some((c: any) => String(c?.name || '').toLowerCase() === 'backend_id');
            if (!hasBackendId) {
              console.log('[DB] Migrating complaints table: adding backend_id column');
              try { this.db.execSync('ALTER TABLE complaints ADD COLUMN backend_id TEXT'); } catch (e) {
                console.warn('[DB] ALTER TABLE complaints ADD COLUMN backend_id failed (may already exist):', e);
              }
            }

            // Ensure parcel_number exists for older databases created before the column was added.
            const hasParcelNumber = Array.isArray(cols) && cols.some((c: any) => String(c?.name || '').toLowerCase() === 'parcel_number');
            if (!hasParcelNumber) {
              console.log('[DB] Migrating complaints table: adding parcel_number column');
              try { this.db.execSync('ALTER TABLE complaints ADD COLUMN parcel_number TEXT'); } catch (e) {
                console.warn('[DB] ALTER TABLE complaints ADD COLUMN parcel_number failed (may already exist):', e);
              }
            }

            // Backfill parcel_number for existing complaints if missing.
            try {
              await this.backfillComplaintParcelNumbers();
            } catch (e) {
              console.warn('[DB] backfillComplaintParcelNumbers failed', e);
            }
          } catch (e) {
            console.warn('[DB] Failed to verify/migrate complaints schema', e);
          }

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
    // Small key/value table for versioning and lightweight migrations.
    this.db.execSync(`CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );`);
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
      backend_id TEXT,
      parcel_number TEXT,
      created_at TEXT,
      data TEXT
    );`);
  }

  private getBundledDbMeta(): { version?: string; counts?: { total?: number } } | null {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require('../../prebuilt/parcelapp.meta.json');
      return (mod && mod.default) ? mod.default : mod;
    } catch (e) {
      return null;
    }
  }

  private getLocalMetaValue(key: string): string | null {
    try {
      const row = this.safeGetFirstSync('SELECT value FROM meta WHERE key = ?', [key]);
      const v = row ? (row as any).value : null;
      return v == null ? null : String(v);
    } catch (e) {
      return null;
    }
  }

  private setLocalMetaValue(key: string, value: string) {
    try {
      if (!this.db) return;
      this.db.runSync('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', [key, value]);
    } catch (e) {
      // ignore
    }
  }

  private async copyBundledDbToSQLiteDir(destName: string): Promise<string | null> {
    try {
      const sqliteDir = `${FileSystem.documentDirectory}SQLite`;
      const dbDest = `${sqliteDir}/${destName}`;
      try {
        const dirInfo = await FileSystem.getInfoAsync(sqliteDir);
        if (!dirInfo.exists) await FileSystem.makeDirectoryAsync(sqliteDir, { intermediates: true });
      } catch (e) {
        // continue
      }

      // Best-effort: remove existing copy
      await FileSystem.deleteAsync(dbDest, { idempotent: true }).catch(() => { });

      const assetPath = require('../../prebuilt/parcelapp.db');
      const asset = Asset.fromModule(assetPath);
      await asset.downloadAsync().catch(() => { });
      const source = asset.localUri || asset.uri;
      if (!source) return null;

      await FileSystem.copyAsync({ from: source, to: dbDest });
      const verify = await FileSystem.getInfoAsync(dbDest);
      if (!verify.exists) return null;
      return dbDest;
    } catch (e) {
      return null;
    }
  }

  private async maybeRefreshParcelsFromBundledDb(): Promise<void> {
    if (!this.db) return;

    const meta = this.getBundledDbMeta();
    const bundledVersion = meta?.version ? String(meta.version) : null;
    const bundledTotal = Number((meta as any)?.counts?.total ?? 0) || 0;

    // If we have no bundled version, we can't safely detect changes.
    if (!bundledVersion) return;

    const localVersion = this.getLocalMetaValue('prebuilt_version');

    const countRow = this.safeGetFirstSync('SELECT COUNT(*) as count FROM parcels');
    const localTotal = countRow ? Number((countRow as any).count ?? 0) : 0;

    // Refresh if the bundled version changed OR local data looks incomplete.
    const needsRefresh = localVersion !== bundledVersion || (bundledTotal > 0 && localTotal < bundledTotal);
    if (!needsRefresh) return;

    console.log('[DB] Refreshing parcels from bundled DB', {
      localVersion,
      bundledVersion,
      localTotal,
      bundledTotal,
    });

    const tempName = 'parcelapp_bundled.db';
    const copiedPath = await this.copyBundledDbToSQLiteDir(tempName);
    if (!copiedPath) {
      console.warn('[DB] Could not copy bundled parcelapp.db into SQLite dir; skipping refresh');
      return;
    }

    let bundledDb: SQLiteDatabase | null = null;
    try {
      bundledDb = SQLite.openDatabaseSync(tempName);

      const bundledCountRow = ((): any => {
        try {
          // Use a tiny inline query helper against the bundled DB.
          return (bundledDb as any)?.getFirstSync
            ? (bundledDb as any).getFirstSync('SELECT COUNT(*) as count FROM parcels')
            : null;
        } catch (e) {
          return null;
        }
      })();

      // Fallback: if getFirstSync isn't available on this build, just proceed.
      const bundledCount = bundledCountRow ? Number(bundledCountRow.count ?? 0) : null;
      if (bundledCount !== null && bundledCount === 0) {
        console.warn('[DB] Bundled DB appears empty; skipping refresh');
        return;
      }

      // Clear and re-import parcels while preserving complaints.
      this.db.execSync('BEGIN;');
      try {
        this.db.execSync('DELETE FROM parcels;');

        let insertStmt: any = null;
        try {
          insertStmt = this.db.prepareSync(
            'INSERT INTO parcels (num_parcel, parcel_type, typ_pers, prenom, nom, prenom_m, nom_m, denominat, village, geometry, properties) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
          );
        } catch (e) {
          insertStmt = null;
        }

        const pageSize = 300;
        let offset = 0;
        while (true) {
          let rows: any[] = [];
          try {
            if ((bundledDb as any)?.getAllSync) {
              rows = (bundledDb as any).getAllSync(
                'SELECT num_parcel, parcel_type, typ_pers, prenom, nom, prenom_m, nom_m, denominat, village, geometry, properties FROM parcels LIMIT ? OFFSET ?'
                , [pageSize, offset]
              ) as any[];
            } else if ((bundledDb as any)?.execSync) {
              // Worst-case fallback: execSync shape differs; bail out.
              rows = [];
            }
          } catch (e) {
            rows = [];
          }

          if (!rows || rows.length === 0) break;

          for (const r of rows) {
            const vals = [
              r.num_parcel ?? null,
              r.parcel_type ?? null,
              r.typ_pers ?? null,
              r.prenom ?? null,
              r.nom ?? null,
              r.prenom_m ?? null,
              r.nom_m ?? null,
              r.denominat ?? null,
              r.village ?? null,
              r.geometry ?? null,
              r.properties ?? null,
            ];
            if (insertStmt?.executeSync) {
              insertStmt.executeSync(vals);
            } else {
              this.db.runSync(
                'INSERT INTO parcels (num_parcel, parcel_type, typ_pers, prenom, nom, prenom_m, nom_m, denominat, village, geometry, properties) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                vals
              );
            }
          }

          offset += rows.length;
        }

        try {
          if (insertStmt?.finalizeSync) insertStmt.finalizeSync();
        } catch (e) {
          // ignore
        }

        this.db.execSync('COMMIT;');
      } catch (e) {
        try { this.db.execSync('ROLLBACK;'); } catch (e2) { /* ignore */ }
        throw e;
      }

      this.setLocalMetaValue('prebuilt_version', bundledVersion);
      if (bundledTotal > 0) this.setLocalMetaValue('prebuilt_parcels_total', String(bundledTotal));
      console.log('[DB] Parcels refresh complete');
    } finally {
      try { bundledDb?.closeSync?.(); } catch (e) { /* ignore */ }
      await FileSystem.deleteAsync(`${FileSystem.documentDirectory}SQLite/${tempName}`, { idempotent: true }).catch(() => { });
    }
  }

  private getComplaintParcelNumber(complaint: any): string | null {
    const norm = (v: any) => {
      if (v === undefined || v === null) return null;
      const s = String(v).trim();
      return s ? s : null;
    };

    // Most common direct shapes - use || to skip empty strings.
    const direct =
      complaint?.parcel_number ||
      complaint?.parcelNumber ||
      complaint?.numero_parcelle ||
      complaint?.numeroParcelle ||
      complaint?.num_parcel ||
      complaint?.Num_parcel;
    const directNorm = norm(direct);
    if (directNorm) return directNorm;

    // Sometimes the complaint is wrapped (e.g. { data: {...} }).
    try {
      if (complaint?.data && typeof complaint.data === 'object') {
        const nested = this.getComplaintParcelNumber(complaint.data);
        if (nested) return nested;
      }
    } catch {
      // ignore
    }

    const pickFromObject = (obj: any): string | null => {
      if (!obj) return null;
      let o: any = obj;
      try {
        if (typeof o === 'string') {
          const trimmed = o.trim();
          if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            o = JSON.parse(trimmed);
          }
        }
      } catch {
        // ignore parse failures
      }
      if (!o || typeof o !== 'object') return null;

      // Fast-path known keys.
      const known =
        o?.num_parcel ??
        o?.Num_parcel ??
        o?.numero_parcelle ??
        o?.Numero_parcelle ??
        o?.parcel_number ??
        o?.parcelNumber ??
        o?.numParcel;
      const knownNorm = norm(known);
      if (knownNorm) return knownNorm;

      // Generic scan: look for any key that *sounds* like parcel number.
      try {
        for (const k of Object.keys(o)) {
          const kl = String(k).toLowerCase();
          if (
            kl === 'numparcel' ||
            kl === 'num_parcel' ||
            kl === 'numero_parcelle' ||
            kl === 'parcel_number' ||
            kl === 'parcelnumber' ||
            kl.includes('num_parcel') ||
            kl.includes('numero_parcelle') ||
            kl.includes('parcel_number')
          ) {
            const candidate = norm(o[k]);
            if (candidate) return candidate;
          }
        }
      } catch {
        // ignore
      }
      return null;
    };

    // Nested parcel shapes.
    const fromParcel = pickFromObject(complaint?.parcel);
    if (fromParcel) return fromParcel;
    const fromSelectedParcel = pickFromObject((complaint as any)?.selectedParcel);
    if (fromSelectedParcel) return fromSelectedParcel;

    return null;
  }

  private async backfillComplaintParcelNumbers(): Promise<number> {
    if (!this.db) return 0;

    // Select only rows where the column is empty/null.
    const rows: any[] = (this.safeGetAllSync(
      "SELECT id, parcel_number, data FROM complaints WHERE parcel_number IS NULL OR TRIM(parcel_number) = ''"
    ) || []) as any[];

    if (!rows.length) return 0;

    let updatedCount = 0;
    for (const r of rows) {
      const id = r?.id ? String(r.id) : '';
      if (!id) continue;

      let parsed: any = null;
      try {
        parsed = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
      } catch {
        parsed = r.data;
      }

      const parcelNumber = this.getComplaintParcelNumber(parsed);
      if (!parcelNumber) continue;

      // Also ensure the JSON blob carries the normalized parcel number so UI/edit flows have it.
      let nextDataStr: string | null = null;
      try {
        if (parsed && typeof parsed === 'object') {
          if (!parsed.parcel_number || String(parsed.parcel_number).trim() === '') parsed.parcel_number = parcelNumber;
          if (!parsed.parcelNumber || String(parsed.parcelNumber).trim() === '') parsed.parcelNumber = parcelNumber;
          nextDataStr = JSON.stringify(parsed);
        }
      } catch {
        nextDataStr = null;
      }

      try {
        let stmt: any = null;
        try {
          if (typeof this.db.prepareSync === 'function') {
            stmt = nextDataStr
              ? this.db.prepareSync('UPDATE complaints SET parcel_number = ?, data = ? WHERE id = ?')
              : this.db.prepareSync('UPDATE complaints SET parcel_number = ? WHERE id = ?');
          }
        } catch {
          stmt = null;
        }

        if (stmt && typeof stmt.executeSync === 'function') {
          if (nextDataStr) stmt.executeSync([parcelNumber, nextDataStr, id]);
          else stmt.executeSync([parcelNumber, id]);
          try { if (typeof stmt.finalizeSync === 'function') stmt.finalizeSync(); } catch { }
        } else {
          const escapeSql = (v: any) => {
            if (v === null || v === undefined) return 'NULL';
            const s = String(v);
            return `'${s.replace(/'/g, "''")}'`;
          };
          const sql = nextDataStr
            ? `UPDATE complaints SET parcel_number = ${escapeSql(parcelNumber)}, data = ${escapeSql(nextDataStr)} WHERE id = ${escapeSql(id)}`
            : `UPDATE complaints SET parcel_number = ${escapeSql(parcelNumber)} WHERE id = ${escapeSql(id)}`;
          this.db.execSync(sql);
        }

        updatedCount += 1;
      } catch {
        // best-effort; continue
      }
    }

    return updatedCount;
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
          'Prenom_M', 'Nom_M', 'Cas_de_Personne_001', 'Quel_est_le_nombre_d_affectata',
          ...Array.from({ length: 27 }, (_, i) => `Prenom_${String(i + 1).padStart(3, '0')}`),
          ...Array.from({ length: 27 }, (_, i) => `Nom_${String(i + 1).padStart(3, '0')}`),
          'grappeSenegal', 'regionSenegal', 'departmentSenegal', 'arrondissementSenegal', 'communeSenegal', 'Village', 'Of', 'Enqueteur'
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
    // Proceed with regular search with intelligent ranking
    try {
      const q = `%${cleanQuery}%`;
      const limit = options?.limit ?? 50;
      const offset = options?.offset ?? 0;

      console.log("Executing intelligent search query with pattern:", q);

      // Enhanced search query with intelligent ranking:
      // 1. Exact matches first (num_parcel = query)
      // 2. Starts with matches (num_parcel LIKE 'query%')
      // 3. Contains matches (num_parcel LIKE '%query%')
      // 4. Name matches (nom, prenom, etc.)
      const searchQuery = `
        SELECT COUNT(*) as total FROM parcels WHERE 
        num_parcel = ? OR
        num_parcel LIKE ? OR
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
        [cleanQuery, `${cleanQuery}%`, q, q, q, q, q, q, q, q]
      );

      const total = (countRow as { total: number })?.total || 0;
      console.log(`Count query found ${total} total matches`);

      if (total === 0) {
        return { rows: [], total: 0 };
      }

      // Enhanced search query with intelligent ranking
      // ORDER BY clause prioritizes:
      // 1. Exact num_parcel match (rank 0)
      // 2. num_parcel starts with query (rank 1)
      // 3. num_parcel contains query (rank 2)
      // 4. Name fields match (rank 3)
      // 5. Other fields match (rank 4)
      const selectQuery = `
        SELECT *, 
          CASE 
            WHEN num_parcel = ? THEN 0
            WHEN num_parcel LIKE ? THEN 1
            WHEN num_parcel LIKE ? THEN 2
            WHEN nom LIKE ? OR prenom LIKE ? OR prenom_m LIKE ? OR nom_m LIKE ? THEN 3
            ELSE 4
          END as relevance_rank
        FROM parcels WHERE 
        num_parcel = ? OR
        num_parcel LIKE ? OR 
        num_parcel LIKE ? OR
        nom LIKE ? OR 
        prenom LIKE ? OR 
        prenom_m LIKE ? OR 
        nom_m LIKE ? OR 
        denominat LIKE ? OR
        village LIKE ? OR
        properties LIKE ? 
        ORDER BY relevance_rank, id 
        LIMIT ? OFFSET ?
      `;

      console.log("Executing select query with intelligent ranking");
      const rawRows: any[] = this.safeGetAllSync(
        selectQuery,
        [
          cleanQuery, `${cleanQuery}%`, q, q, q, q, q,  // relevance calculation params
          cleanQuery, `${cleanQuery}%`, q, q, q, q, q, q, q, q,  // WHERE clause params
          limit, offset
        ]
      ) || [];

      console.log(`Query returned ${rawRows.length} results`);

      // Log the first few results for debugging
      if (rawRows.length > 0) {
        console.log("First result:",
          JSON.stringify({
            id: rawRows[0].id,
            num_parcel: rawRows[0].num_parcel,
            parcel_type: rawRows[0].parcel_type,
            relevance_rank: rawRows[0].relevance_rank,
            nom: rawRows[0].nom,
            prenom: rawRows[0].prenom
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
          'Prenom_M', 'Nom_M', 'Cas_de_Personne_001', 'Quel_est_le_nombre_d_affectata',
          // indexed affectataires
          ...Array.from({ length: 27 }, (_, i) => `Prenom_${String(i + 1).padStart(3, '0')}`),
          ...Array.from({ length: 27 }, (_, i) => `Nom_${String(i + 1).padStart(3, '0')}`),
          'grappeSenegal', 'regionSenegal', 'departmentSenegal', 'arrondissementSenegal', 'communeSenegal', 'Village', 'Of', 'Enqueteur'
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
      // Local complaints use a local UUID primary key; remote uses backend_id.
      const looksLikeUuid = (s: any) => typeof s === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(s);
      if (!complaint.id || !looksLikeUuid(complaint.id)) {
        const uuidv4 = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
          const r = (Math.random() * 16) | 0;
          const v = c === 'x' ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });
        complaint.id = uuidv4();
      }

      // Default workflow flags for new complaints
      if (complaint.status === undefined || complaint.status === null || complaint.status === '') {
        complaint.status = 'pending';
      }
      if (complaint.sent_remote === undefined || complaint.sent_remote === null) {
        complaint.sent_remote = false;
      }

      // Never persist backend_id inside the JSON blob.
      const complaintForJson = { ...(complaint || {}) };
      try { delete (complaintForJson as any).backend_id; } catch { }

      // Normalize parcel number consistently (column + JSON) so reads/edits always see it.
      const parcelNumber = this.getComplaintParcelNumber(complaint);
      try {
        if (parcelNumber) {
          (complaintForJson as any).parcel_number = parcelNumber;
          (complaintForJson as any).parcelNumber = parcelNumber;
        }
      } catch { }

      // Ensure complaints table exists
      try {
        this.db.execSync(`CREATE TABLE IF NOT EXISTS complaints (
          id TEXT PRIMARY KEY,
          backend_id TEXT,
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
              'INSERT OR REPLACE INTO complaints (id, backend_id, parcel_number, created_at, data) VALUES (?, ?, ?, ?, ?)'
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
              null,
              parcelNumber,
              new Date().toISOString(),
              JSON.stringify(complaintForJson),
            ]);
          } catch (stmtExecErr) {
            console.error('Prepared statement execute failed, falling back to file storage:', stmtExecErr);
            // Fallback to file-based complaints storage
            await this.appendFallbackComplaintFile({ id: complaint.id, parcelNumber: this.getComplaintParcelNumber(complaint), created_at: new Date().toISOString(), ...complaintForJson });
            return complaint.id;
          }
        } else {
          // Fallback: construct a safe SQL literal and use execSync
          try {
            const idVal = escapeSql(complaint.id);
            const parcelVal = parcelNumber ? escapeSql(parcelNumber) : 'NULL';
            const createdVal = escapeSql(new Date().toISOString());
            const dataVal = escapeSql(JSON.stringify(complaintForJson));
            const sql = `INSERT OR REPLACE INTO complaints (id, backend_id, parcel_number, created_at, data) VALUES (${idVal}, NULL, ${parcelVal}, ${createdVal}, ${dataVal})`;
            try {
              this.db.execSync(sql);
            } catch (execErr) {
              console.error('Fallback execSync insert failed, writing to fallback file instead:', execErr);
              await this.appendFallbackComplaintFile({ id: complaint.id, parcelNumber: parcelNumber, created_at: new Date().toISOString(), ...complaintForJson });
              return complaint.id;
            }
          } catch (e) {
            console.error('Unexpected error preparing fallback insert, storing to fallback file:', e);
            await this.appendFallbackComplaintFile({ id: complaint.id, parcelNumber: this.getComplaintParcelNumber(complaint), created_at: new Date().toISOString(), ...complaintForJson });
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

      // Force-write parcel_number column after insert (avoids cases where JSON is saved but column stays empty).
      try {
        if (parcelNumber) {
          let upd: any = null;
          try {
            if (typeof this.db.prepareSync === 'function') {
              upd = this.db.prepareSync('UPDATE complaints SET parcel_number = ? WHERE id = ?');
            }
          } catch {
            upd = null;
          }
          if (upd && typeof upd.executeSync === 'function') {
            try { upd.executeSync([parcelNumber, complaint.id]); } catch { }
            try { if (typeof upd.finalizeSync === 'function') upd.finalizeSync(); } catch { }
          } else {
            const escapeSql2 = (v: any) => { if (v === null || v === undefined) return 'NULL'; const s = String(v); return `'${s.replace(/'/g, "''")}'`; };
            try { this.db.execSync(`UPDATE complaints SET parcel_number = ${escapeSql2(parcelNumber)} WHERE id = ${escapeSql2(complaint.id)}`); } catch { }
          }
        }
      } catch { }

      // Kick off an asynchronous remote submit to Supabase (best-effort).
      // If the caller intentionally set a temporary flag `_skip_background_submit`
      // we will NOT automatically try to submit (this prevents duplicate
      // concurrent sends when the UI explicitly triggers a send right after
      // saving). The temporary flag is not persisted into the stored JSON.
      try {
        const skipBackground = !!complaint._skip_background_submit;
        // Remove temporary flag from stored payload so it doesn't persist
        try { if (complaint._skip_background_submit) delete complaint._skip_background_submit; } catch (e) { /* ignore */ }
        if (!skipBackground) {
          // fire-and-forget but capture errors
          setTimeout(() => {
            (async () => {
              try {
                await this.tryRemoteSubmit(complaint);
              } catch (e) {
                console.warn('tryRemoteSubmit failed', e);
              }
            })();
          }, 0);
        }
      } catch (e) {
        console.warn('Failed to schedule remote submit', e);
      }

      return complaint.id;
    } catch (e) {
      console.error('addComplaint error:', e);
      throw e;
    }
  }

  /**
   * Attempt to submit a saved complaint to Supabase. If the client is not
   * configured this is a no-op. On success/failure this will update the local
   * complaint row's data field to include sent_remote and remote_response.
   */
  private async tryRemoteSubmit(complaint: any) {
    if (!this.supabase) {
      // No supabase configured; nothing to do
      console.warn('tryRemoteSubmit: supabase client not configured for remote submit');
      return { sent: false, resp: 'supabase_not_configured' };
    }

    // local lock key used to prevent concurrent sends for the same local complaint
    let localLockKey: string | null = null;

    try {
      const localId = complaint && complaint.id ? String(complaint.id) : '';
      if (!localId) return { sent: false, resp: 'missing_local_id' };

      // Use local id as the lock key to prevent concurrent sends
      localLockKey = localId;
      if (this.sendingMap.get(localLockKey)) {
        console.log('tryRemoteSubmit: send already in progress for local id', localLockKey);
        return { sent: false, resp: 'already_sending', code: 'already_sending' };
      }
      this.sendingMap.set(localLockKey, true);

      // Load the CURRENT row from DB so we sync the latest data and backend_id.
      const row: any = this.safeGetFirstSync('SELECT backend_id, parcel_number, data FROM complaints WHERE id = ? LIMIT 1', [localId]);
      const backendId = row?.backend_id ? String(row.backend_id) : null;
      let current: any = complaint;
      try {
        if (row?.data && typeof row.data === 'string') current = JSON.parse(row.data);
        else if (row?.data && typeof row.data === 'object') current = row.data;
      } catch {
        current = complaint;
      }

      const parcelNumber = this.getComplaintParcelNumber(current) || (row?.parcel_number ? String(row.parcel_number) : null);

      const payloadBase: any = {
        // Support both v2 (snake_case) and legacy (camelCase) shapes
        parcel_number: parcelNumber,
        type_usage: current.type_usage || current.typeUsage || current.type_usag || null,
        nature_parcelle: current.nature_parcelle || current.natureParcelle || current.nature || null,
        date: current.date || null,
        activity: current.activity || null,
        commune: current.commune || null,
        village: current.village || null,
        complainant_name: current.complainant_name || current.complainantName || null,
        complainant_sex: current.complainant_sex || current.complainantSex || null,
        complainant_id: current.complainant_id || current.complainantId || null,
        complainant_contact: current.complainant_contact || current.complainantContact || null,
        complaint_reason: current.complaint_reason || current.complaintReason || null,
        complaint_reception_mode: current.complaint_reception_mode || current.complaintReceptionMode || null,
        complaint_category: current.complaint_category || current.complaintCategory || null,
        complaint_description: current.complaint_description || current.complaintDescription || null,
        expected_resolution: current.expected_resolution || current.expectedResolution || null,
        complaint_function: current.complaint_function || current.complaintFunction || null,
        data: current, // store full object as JSON on remote as well
        source: 'client',
      };

      // Insert/update based on backend_id
      let sent = false;
      let respText = '';
      let resp: any = null;
      let newBackendId: string | null = null;
      if (!backendId) {
        console.log('tryRemoteSubmit: inserting to Supabase (no backend_id) for local id', localId);
        // Insert: exclude id so backend generates it
        const insertPayload = { ...payloadBase, created_at: new Date().toISOString() };
        try { delete (insertPayload as any).id; } catch { }
        // IMPORTANT: Avoid `.select()` here.
        // In many Supabase setups, RLS allows INSERT but denies SELECT.
        // Calling `.select()` forces "return=representation" and can make the
        // request fail even though the insert itself would be allowed.
        resp = await this.supabase.from('complaints').insert([insertPayload]);
        if (resp?.error) {
          sent = false;
          const err = resp.error;
          respText = err.message || JSON.stringify(err);
        } else {
          sent = true;
          // If the server returned data anyway, try to extract id.
          const created = Array.isArray(resp.data) ? resp.data[0] : resp.data;
          if (created?.id) newBackendId = String(created.id);
          respText = JSON.stringify({ status: resp?.status, statusText: resp?.statusText } as any);
        }
      } else {
        // Same rationale as INSERT: avoid `.select()` to prevent RLS "SELECT denied" failures.
        resp = await this.supabase.from('complaints').update(payloadBase).eq('id', backendId);
        if (resp?.error) {
          sent = false;
          const err = resp.error;
          respText = err.message || JSON.stringify(err);
        } else {
          sent = true;
          respText = JSON.stringify({ status: resp?.status, statusText: resp?.statusText } as any);
        }
      }

      // Update local complaint record with sent_remote and remote_response in its data JSON
      try {
        const updatedComplaint: any = { ...current, sent_remote: sent, remote_response: respText };

        // Auto-label as validated after successful send, but don't overwrite a manual rejection.
        const currentStatus = String((current as any)?.status || '').toLowerCase();
        if (sent) {
          if (!currentStatus || currentStatus === 'pending' || currentStatus === 'en attente') {
            updatedComplaint.status = 'validated';
          }
        } else {
          if (!currentStatus) {
            updatedComplaint.status = 'pending';
          }
        }
        // Never store backend_id in JSON
        try { delete (updatedComplaint as any).backend_id; } catch { }

        // Write back local changes + backend_id column when created
        const backendToWrite = newBackendId || backendId;
        let updStmt: any = null;
        try {
          if (typeof this.db?.prepareSync === 'function') {
            updStmt = this.db!.prepareSync('UPDATE complaints SET backend_id = COALESCE(?, backend_id), parcel_number = COALESCE(?, parcel_number), data = ? WHERE id = ?');
          }
        } catch {
          updStmt = null;
        }
        if (updStmt && typeof updStmt.executeSync === 'function') {
          try {
            updStmt.executeSync([
              backendToWrite,
              parcelNumber,
              JSON.stringify(updatedComplaint),
              localId,
            ]);
          } catch (e) {
            console.warn('Prepared update failed for complaint remote metadata', e);
          } finally {
            try { if (typeof updStmt.finalizeSync === 'function') updStmt.finalizeSync(); } catch { }
          }
        } else {
          const escapeSql = (v: any) => { if (v === null || v === undefined) return 'NULL'; const s = String(v); return `'${s.replace(/'/g, "''")}'`; };
          try {
            const sql = `UPDATE complaints SET backend_id = COALESCE(${escapeSql(backendToWrite)}, backend_id), parcel_number = COALESCE(${escapeSql(parcelNumber)}, parcel_number), data = ${escapeSql(JSON.stringify(updatedComplaint))} WHERE id = ${escapeSql(localId)}`;
            try { this.db && this.db.execSync(sql); } catch (e) { console.warn('Fallback execSync update failed', e); }
          } catch (e) {
            console.warn('Failed to update local complaint with remote metadata', e);
          }
        }
      } catch (e) {
        console.warn('Error while trying to write remote metadata to local DB', e);
      }

      return { sent, resp: respText, raw: resp };
    } catch (e) {
      console.warn('tryRemoteSubmit unexpected error for complaint id', complaint && complaint.id, e);
      return { sent: false, resp: String(e), error: e };
    } finally {
      try {
        if (localLockKey) this.sendingMap.delete(localLockKey);
      } catch (e) { /* ignore */ }
    }
  }

  /**
   * Public API: send a complaint now. Accepts either an object (the complaint)
   * or an id (string). Returns { sent, resp } or null on no-op.
   */
  async sendComplaint(complaintOrId: any) {
    try {
      let complaintObj: any = null;
      if (!complaintOrId) return null;
      if (typeof complaintOrId === 'string') {
        complaintObj = await this.getComplaintById(complaintOrId);
      } else if (typeof complaintOrId === 'object') {
        complaintObj = complaintOrId;
      }
      if (!complaintObj) return null;
      return await this.tryRemoteSubmit(complaintObj);
    } catch (e) {
      console.warn('sendComplaint error', e);
      return null;
    }
  }

  /**
   * Scan local complaints and retry any that are not marked sent_remote === true
   */
  async retryUnsentComplaints() {
    if (!this.db) return 0;
    if (!this.supabase) return 0;
    try {
      const rows: any[] = (this.safeGetAllSync('SELECT id, backend_id, data FROM complaints') || []) as any[];
      let attempted = 0;
      for (const r of rows) {
        let parsed: any = null;
        try { parsed = (r && typeof (r as any).data === 'string') ? JSON.parse((r as any).data) : (r as any).data; } catch (e) { parsed = (r as any).data; }
        if (!parsed) continue;
        // If a complaint is already marked as sent, do not retry.
        // This prevents duplicate inserts when RLS blocks returning the created id
        // (backend_id stays null even though the insert succeeded).
        if (parsed.sent_remote === true) continue;
        attempted += 1;
        try {
          await this.tryRemoteSubmit(parsed);
        } catch (e) {
          console.warn('retryUnsentComplaints: submit failed for', (r as any).id, e);
        }
      }
      return attempted;
    } catch (e) {
      console.warn('retryUnsentComplaints error', e);
      return 0;
    }
  }

  /**
   * Return a parsed complaint by id from the local complaints table (data JSON)
   */
  async getComplaintById(id: string) {
    if (!this.db) return null;
    try {
      const row: any = this.safeGetFirstSync('SELECT id, backend_id, parcel_number, created_at, data FROM complaints WHERE id = ? LIMIT 1', [id]);
      if (!row) return null;
      let parsed: any = null;
      try { parsed = typeof row.data === 'string' ? JSON.parse(row.data) : row.data; } catch { parsed = row.data; }
      const merged = {
        ...(parsed || {}),
        id: row.id,
        parcel_number: row.parcel_number || parsed?.parcel_number || parsed?.parcelNumber || parsed?.numero_parcelle || null,
        parcelNumber: row.parcel_number || parsed?.parcelNumber || parsed?.parcel_number || parsed?.numero_parcelle || null,
        backend_id: row.backend_id || null,
        created_at: row.created_at || parsed?.created_at || null,
      };
      // Ensure backend_id is not duplicated inside JSON
      try { delete (merged as any).backend_id_in_data; } catch { }
      return merged;
    } catch (e) {
      console.warn('getComplaintById error', e);
      return null;
    }
  }

  /**
   * Update an existing complaint's data JSON locally. Does not alter remote state.
   */
  async updateComplaint(complaint: any) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    if (!complaint || !complaint.id) throw new Error('Invalid complaint');
    try {
      // Read existing backend_id from DB so we never lose it
      const existingRow: any = this.safeGetFirstSync('SELECT backend_id FROM complaints WHERE id = ? LIMIT 1', [complaint.id]);
      const existingBackendId = existingRow?.backend_id || null;

      // Never persist backend_id inside the JSON blob.
      const complaintForJson: any = { ...(complaint || {}) };
      try { delete complaintForJson.backend_id; } catch { }
      try { delete complaintForJson.backendId; } catch { }
      try { delete complaintForJson.backend_id_in_data; } catch { }

      // Prefer existing backend_id from DB; only use complaint's if DB had none
      const backendIdToWrite = existingBackendId || (complaint as any)?.backend_id || (complaint as any)?.backendId || null;
      const parcelNumberToWrite = this.getComplaintParcelNumber(complaint) || null;
      try {
        if (parcelNumberToWrite) {
          if ((complaintForJson as any).parcel_number === undefined || (complaintForJson as any).parcel_number === null || String((complaintForJson as any).parcel_number).trim() === '') {
            (complaintForJson as any).parcel_number = parcelNumberToWrite;
          }
          if ((complaintForJson as any).parcelNumber === undefined || (complaintForJson as any).parcelNumber === null || String((complaintForJson as any).parcelNumber).trim() === '') {
            (complaintForJson as any).parcelNumber = parcelNumberToWrite;
          }
        }
      } catch { }

      const dataStr = JSON.stringify(complaintForJson);

      const updStmt = (typeof this.db.prepareSync === 'function')
        ? this.db.prepareSync('UPDATE complaints SET backend_id = COALESCE(?, backend_id), parcel_number = COALESCE(?, parcel_number), data = ? WHERE id = ?')
        : null;

      if (updStmt && typeof updStmt.executeSync === 'function') {
        try { updStmt.executeSync([backendIdToWrite, parcelNumberToWrite, dataStr, complaint.id]); } catch (e) { console.warn('updateComplaint stmt failed', e); }
        try { if (typeof updStmt.finalizeSync === 'function') updStmt.finalizeSync(); } catch (e) { }
      } else {
        const escapeSql = (v: any) => { if (v === null || v === undefined) return 'NULL'; const s = String(v); return `'${s.replace(/'/g, "''")}'`; };
        try {
          this.db.execSync(
            `UPDATE complaints SET backend_id = COALESCE(${escapeSql(backendIdToWrite)}, backend_id), parcel_number = COALESCE(${escapeSql(parcelNumberToWrite)}, parcel_number), data = ${escapeSql(dataStr)} WHERE id = ${escapeSql(complaint.id)}`
          );
        } catch (e) {
          console.warn('updateComplaint exec failed', e);
        }
      }
      return true;
    } catch (e) {
      console.warn('updateComplaint unexpected error', e);
      return false;
    }
  }

  /**
   * Update only the status field inside the stored complaint JSON.
   */
  async updateComplaintStatus(id: string, status: 'pending' | 'validated' | 'rejected') {
    if (!id) return false;
    try {
      const existing = await this.getComplaintById(id);
      if (!existing) return false;
      const updated = { ...existing, status };
      return await this.updateComplaint(updated);
    } catch (e) {
      console.warn('updateComplaintStatus error', e);
      return false;
    }
  }

  /**
   * Delete a complaint locally.
   */
  async deleteComplaint(id: string) {
    if (!id) return false;

    // If DB isn't available, try the fallback file.
    if (!this.db) {
      try {
        const arr = await this.readFallbackComplaintsFile();
        const next = arr.filter((it: any) => String(it?.id) !== String(id));
        await this.writeFallbackComplaintsFile(next);
        return true;
      } catch (e) {
        console.warn('deleteComplaint fallback error', e);
        return false;
      }
    }

    try {
      const stmt = (typeof this.db.prepareSync === 'function') ? this.db.prepareSync('DELETE FROM complaints WHERE id = ?') : null;
      if (stmt && typeof stmt.executeSync === 'function') {
        try { stmt.executeSync([id]); } catch (e) { console.warn('deleteComplaint stmt failed', e); }
        try { if (typeof stmt.finalizeSync === 'function') stmt.finalizeSync(); } catch (e) { }
      } else {
        const escapeSql = (v: any) => { if (v === null || v === undefined) return 'NULL'; const s = String(v); return `'${s.replace(/'/g, "''")}'`; };
        try { this.db.execSync(`DELETE FROM complaints WHERE id = ${escapeSql(id)}`); } catch (e) { console.warn('deleteComplaint exec failed', e); }
      }
      return true;
    } catch (e) {
      console.warn('deleteComplaint unexpected error', e);
      return false;
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
          id: 'id', parcelNumber: 'numero_parcelle', date: 'date', activity: 'activite', commune: 'commune', village: 'village', complainantName: 'nom_plaignant', complainantSex: 'sexe_plaignant', complainantId: 'id_plaignant', complainantContact: 'contact_plaignant', complaintCategory: 'categorie_plainte', complaintDescription: 'description_plainte', complaintReason: 'raison_plainte', complaintReceptionMode: 'mode_reception', expectedResolution: 'resolution_attendue'
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
              console.debug('exportComplaints: JSON.parse failed for row id=', r && r.id, 'raw data sample=', (r && r.data && typeof r.data === 'string') ? (r.data.length > 200 ? r.data.slice(0, 200) + '... (truncated)' : r.data) : r && r.data, 'error=', e);
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

      // Ensure newly-added columns are always present in the export headers
      // even if some complaints were created before the fields existed.
      ['type_usage', 'nature_parcelle', 'typeUsage', 'natureParcelle'].forEach((k) => allKeys.add(k));

      // Preferred column ordering (if you want specific order, list keys here)
      const headerFields = Array.from(allKeys);

      // Map English keys to French labels for CSV headers (keep values as-is)
      const translations: Record<string, string> = {
        id: 'id',
        parcelNumber: 'numero_parcelle',
        typeUsage: 'type_usage',
        natureParcelle: 'nature_parcelle',
        type_usage: 'type_usage',
        nature_parcelle: 'nature_parcelle',
        date: 'date',
        activity: 'activite',
        commune: 'commune',
        village: 'village',
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
      const rows = this.safeGetAllSync('SELECT id, backend_id, parcel_number, created_at, data FROM complaints ORDER BY created_at DESC') || [];
      return rows.map((r: any) => {
        let parsed: any = null;
        try { parsed = JSON.parse(r.data); } catch { parsed = r.data; }
        return {
          ...(parsed || {}),
          id: r.id,
          parcel_number: r.parcel_number || parsed?.parcel_number || parsed?.parcelNumber || parsed?.numero_parcelle || null,
          parcelNumber: r.parcel_number || parsed?.parcelNumber || parsed?.parcel_number || parsed?.numero_parcelle || null,
          backend_id: r.backend_id || null,
          created_at: r.created_at || parsed?.created_at || null,
        };
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
    if (!this.db) {
      try { await this.initializeDatabase(); } catch (e) { console.warn('getNeighborParcels: initializeDatabase failed', e); }
    }
    if (!this.db) throw new Error('Database is not initialized.');
    if (!parcelNum) { console.warn('getNeighborParcels called with empty parcel number'); return []; }

    const cacheKey = `neighbors_${parcelNum}`;
    const cached = this.queryCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < NEIGHBOR_CACHE_TTL_MS)) return cached.result;

    try {
      // Load the parcel row
      const parcel: any = this.safeGetFirstSync('SELECT geometry, properties, min_lat, min_lng, max_lat, max_lng FROM parcels WHERE num_parcel = ?', [parcelNum]);
      if (!parcel) { console.warn(`Parcel with number ${parcelNum} not found`); return []; }

      // Parse geometry if present
      let geometry: any = null;
      try { geometry = parcel.geometry ? JSON.parse(String(parcel.geometry)) : null; } catch (e) { geometry = null; }

      // Candidate collection: commune, department, bbox, fallback
      let candidateRows: any[] = [];

      // Commune heuristic
      try {
        const parsedProps = parcel.properties ? JSON.parse(String(parcel.properties)) : {};
        const keysToCheck = ['communeSenegal', 'communesenegal', 'commune', 'Commune', 'communes'];
        let communeName: string | null = null;
        for (const k of keysToCheck) {
          if (parsedProps && parsedProps[k]) { communeName = String(parsedProps[k]).trim(); break; }
          const lk = String(k).toLowerCase(); if (parsedProps && parsedProps[lk]) { communeName = String(parsedProps[lk]).trim(); break; }
        }
        if (communeName) {
          const rows = this.safeGetAllSync(`SELECT * FROM parcels WHERE num_parcel != ? AND properties LIKE ? LIMIT ${DEFAULT_NEIGHBOR_LIMIT}`, [parcelNum, `%${communeName}%`]) || [];
          if (rows.length) candidateRows = candidateRows.concat(rows.slice(0, DEFAULT_NEIGHBOR_LIMIT));
        }
      } catch (e) { /* ignore */ }

      // Department heuristic
      try {
        const parsedProps = parcel.properties ? JSON.parse(String(parcel.properties)) : {};
        const deptKeys = ['departmentSenegal', 'departementsenegal', 'department', 'Département', 'DEPARTMENT'];
        let deptName: string | null = null;
        for (const k of deptKeys) {
          if (parsedProps && parsedProps[k]) { deptName = String(parsedProps[k]).trim(); break; }
          const lk = String(k).toLowerCase(); if (parsedProps && parsedProps[lk]) { deptName = String(parsedProps[lk]).trim(); break; }
        }
        if (deptName) {
          const rows = this.safeGetAllSync(`SELECT * FROM parcels WHERE num_parcel != ? AND properties LIKE ? LIMIT ${DEFAULT_NEIGHBOR_LIMIT * 5}`, [parcelNum, `%${deptName}%`]) || [];
          if (rows.length) candidateRows = candidateRows.concat(rows.slice(0, DEFAULT_NEIGHBOR_LIMIT));
        }
      } catch (e) { /* ignore */ }

      // Compute centroid helper
      const computeCentroid = (coords: number[][], assumeLonLat = true) => {
        let sLat = 0, sLng = 0, cnt = 0;
        for (const c of coords) {
          if (!Array.isArray(c) || c.length < 2) continue;
          const a = Number(c[0]), b = Number(c[1]);
          if (assumeLonLat) { sLng += a; sLat += b; } else { sLat += a; sLng += b; }
          cnt++;
        }
        if (!cnt) return null;
        return { lat: sLat / cnt, lng: sLng / cnt };
      };

      // Normalize geometry if possible
      let norm: any = geometry;
      try {
        const geomUtils: any = require('../utils/geometryUtils');
        const normalize = geomUtils && (geomUtils.normalizeGeometry || (geomUtils.default && geomUtils.default.normalizeGeometry));
        if (typeof normalize === 'function') norm = normalize(geometry) || geometry;
      } catch (e) {
        norm = geometry;
      }

      // Determine target centroid
      let centroidLat = NaN, centroidLng = NaN;
      try {
        let ring: number[][] | null = null;
        if (norm && norm.type === 'Polygon' && Array.isArray(norm.coordinates[0])) ring = norm.coordinates[0];
        else if (norm && norm.type === 'MultiPolygon' && Array.isArray(norm.coordinates) && norm.coordinates[0] && Array.isArray(norm.coordinates[0][0])) ring = norm.coordinates[0][0];
        if (ring && ring.length > 0) {
          const c1 = computeCentroid(ring, true);
          const c2 = computeCentroid(ring, false);
          const plausibleFn = (c: any) => !!c && c.lat >= 4.0 && c.lat <= 20.0 && c.lng >= -20.0 && c.lng <= -4.0;
          const chosen = (c1 && plausibleFn(c1)) ? c1 : ((c2 && plausibleFn(c2)) ? c2 : (c1 || c2));
          if (chosen) { centroidLat = chosen.lat; centroidLng = chosen.lng; }
        }
      } catch (e) { /* ignore centroid errors */ }

      // BBOX candidate selection (augment or replace candidates)
      try {
        if (parcel.min_lat != null && parcel.min_lng != null && parcel.max_lat != null && parcel.max_lng != null) {
          const BBOX_DELTA = 0.01; // ~1.1km
          const minLat = Number(parcel.min_lat) - BBOX_DELTA;
          const maxLat = Number(parcel.max_lat) + BBOX_DELTA;
          const minLng = Number(parcel.min_lng) - BBOX_DELTA;
          const maxLng = Number(parcel.max_lng) + BBOX_DELTA;
          const rows = this.safeGetAllSync(`SELECT * FROM parcels WHERE num_parcel != ? AND min_lat IS NOT NULL AND min_lng IS NOT NULL AND max_lat IS NOT NULL AND max_lng IS NOT NULL AND NOT (max_lat < ? OR min_lat > ? OR max_lng < ? OR min_lng > ?)`, [parcelNum, minLat, maxLat, minLng, maxLng]) || [];
          if (rows.length) candidateRows = rows; // use bbox candidates (prefer spatially local)
        }
      } catch (e) { /* ignore bbox errors */ }

      // If still empty, fall back to a bounded scan of parcels with geometry
      if (!candidateRows || candidateRows.length === 0) {
        candidateRows = this.safeGetAllSync(`SELECT * FROM parcels WHERE num_parcel != ? AND geometry IS NOT NULL LIMIT 2000`, [parcelNum]) || [];
      }

      // Haversine function
      const toRad = (v: number) => v * Math.PI / 180;
      const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const rLat1 = toRad(lat1), rLat2 = toRad(lat2);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return 6371000 * c;
      };

      const MAX_DIST_METERS = 1000;
      const plausibleCentroid = (lat: number, lng: number) => (isFinite(lat) && isFinite(lng) && lat >= 4.0 && lat <= 20.0 && lng >= -20.0 && lng <= -4.0);

      // If centroid is invalid, try extracting from properties once more
      if (!plausibleCentroid(centroidLat, centroidLng)) {
        try {
          const propsParsed = parcel.properties ? JSON.parse(String(parcel.properties)) : null;
          const extracted = this.extractGeometryFromProperties(propsParsed);
          if (extracted) {
            try {
              const geomUtils: any = require('../utils/geometryUtils');
              const normalize = geomUtils && (geomUtils.normalizeGeometry || (geomUtils.default && geomUtils.default.normalizeGeometry));
              const en = (typeof normalize === 'function') ? (normalize(extracted) || extracted) : extracted;
              let ering: number[][] | null = null;
              if (en && en.type === 'Polygon' && Array.isArray(en.coordinates[0])) ering = en.coordinates[0];
              else if (en && en.type === 'MultiPolygon' && Array.isArray(en.coordinates) && en.coordinates[0] && Array.isArray(en.coordinates[0][0])) ering = en.coordinates[0][0];
              if (ering && ering.length > 0) {
                const c1 = computeCentroid(ering, true);
                const c2 = computeCentroid(ering, false);
                const chosen = (c1 && plausibleCentroid(c1.lat, c1.lng)) ? c1 : ((c2 && plausibleCentroid(c2.lat, c2.lng)) ? c2 : (c1 || c2));
                if (chosen) { centroidLat = chosen.lat; centroidLng = chosen.lng; }
              }
            } catch (e) { /* ignore */ }
          }
        } catch (e) { /* ignore */ }
      }

      // Score candidates by distance if centroid is valid
      const scored: Array<{ row: any; dist: number }> = [];
      if (plausibleCentroid(centroidLat, centroidLng)) {
        for (const r of candidateRows) {
          try {
            const rawGeom = r.geometry;
            if (!rawGeom) continue;
            let g = null;
            try { g = typeof rawGeom === 'string' ? JSON.parse(rawGeom) : rawGeom; } catch (e) { g = null; }
            if (!g) continue;
            let rnorm: any = g;
            try { const gu = require('../utils/geometryUtils'); const normFn = gu && (gu.normalizeGeometry || (gu.default && gu.default.normalizeGeometry)); if (typeof normFn === 'function') rnorm = normFn(g) || g; } catch (e) { rnorm = g; }
            let rring: number[][] | null = null;
            if (rnorm && rnorm.type === 'Polygon' && Array.isArray(rnorm.coordinates[0])) rring = rnorm.coordinates[0];
            else if (rnorm && rnorm.type === 'MultiPolygon' && Array.isArray(rnorm.coordinates) && rnorm.coordinates[0] && Array.isArray(rnorm.coordinates[0][0])) rring = rnorm.coordinates[0][0];
            if (!rring || rring.length === 0) continue;
            const c1 = computeCentroid(rring, true);
            const c2 = computeCentroid(rring, false);
            const chosen = (c1 && plausibleCentroid(c1.lat, c1.lng)) ? c1 : ((c2 && plausibleCentroid(c2.lat, c2.lng)) ? c2 : (c1 || c2));
            if (!chosen) continue;
            const d = haversine(centroidLat, centroidLng, chosen.lat, chosen.lng);
            if (!isFinite(d)) continue;
            scored.push({ row: r, dist: d });
          } catch (e) {
            // ignore malformed candidate
          }
        }
      }

      // Sort and pick best
      scored.sort((a, b) => a.dist - b.dist);
      const top = scored.slice(0, DEFAULT_NEIGHBOR_LIMIT).map(s => {
        try { s.row.__neighbor_distance_m = s.dist; s.row.__neighbor_within_1km = s.dist <= MAX_DIST_METERS; } catch (e) { }
        return s.row;
      });

      // If no scored candidates but we have raw rows, return fallback with null distances
      let result: any[] = top;
      if ((!result || result.length === 0) && Array.isArray(candidateRows) && candidateRows.length > 0) {
        result = candidateRows.slice(0, DEFAULT_NEIGHBOR_LIMIT).map((r: any) => ({ ...r, __neighbor_distance_m: null, __neighbor_within_1km: false }));
      }

      this.queryCache.set(cacheKey, { timestamp: Date.now(), result });
      return result;
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
      if (['geometry', 'geom', 'geojson'].includes(lower)) {
        pushIf(typeof props[k] === 'string' ? (() => { try { return JSON.parse(props[k]); } catch { return null; } })() : props[k]);
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
    const result: any = {
      isInitialized: !!this.db,
      hasParcelTable: false,
      rowCount: 0,
      sampleData: null,
    };

    try {
      if (!this.db) return result;
      const tableCheck = this.safeGetFirstSync("SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='parcels'");
      result.hasParcelTable = tableCheck ? ((tableCheck as any).count > 0) : false;

      if (result.hasParcelTable) {
        const countResult = this.safeGetFirstSync("SELECT COUNT(*) as count FROM parcels");
        result.rowCount = countResult ? (countResult as any).count : 0;
        if (result.rowCount > 0) {
          result.sampleData = this.safeGetAllSync("SELECT id, num_parcel, parcel_type, nom, prenom, nom_m, prenom_m, village FROM parcels LIMIT 5") || [];
        }
      }
    } catch (e) {
      console.error('getDiagnostics error', e);
    }

    return result;
  }

}

// Create and export singleton instance
const databaseManagerInstance = DatabaseManager.getInstance();
export default databaseManagerInstance;
export { DatabaseManager };


