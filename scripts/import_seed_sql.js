const fs = require('fs');
const path = require('path');

(async function main(){
  try {
    const outDir = path.join(__dirname, '..', 'prebuilt');
    const sqlPath = path.join(outDir, 'seed_parcels.sql');
    const dbPath = path.join(outDir, 'parcelapp.db');

    if (!fs.existsSync(sqlPath)) {
      console.error('seed SQL file not found:', sqlPath);
      process.exit(1);
    }

    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Lazy require so script fails with a clear message if sqlite3 is missing
    let sqlite3;
    try { sqlite3 = require('sqlite3').verbose(); } catch (e) {
      console.error('sqlite3 npm package not found. Please run: npm install sqlite3');
      process.exit(1);
    }

    // Ensure prebuilt dir exists
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    console.log('Opening DB at', dbPath);
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Failed to open DB:', err);
        process.exit(1);
      }
    });

    db.serialize(() => {
      console.log('Creating required tables if missing...');
      db.exec(`CREATE TABLE IF NOT EXISTS parcels (
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
      );

      CREATE TABLE IF NOT EXISTS complaints (
        id TEXT PRIMARY KEY,
        parcel_number TEXT,
        created_at TEXT,
        data TEXT
      );
      `, function(tableErr) {
        if (tableErr) {
          console.error('Error creating tables:', tableErr);
          process.exit(1);
        }
        console.log('Executing SQL... this may take a while for large files');
        db.exec(sql, function(err) {
        if (err) {
          console.error('Error executing SQL:', err);
          process.exit(1);
        }
        console.log('SQL import completed successfully');
        // Optionally verify row count
        db.get('SELECT COUNT(*) as count FROM parcels', (e, row) => {
          if (!e) console.log('parcels table row count:', row && row.count);
          db.close();
        });
        });
      });
    });
  } catch (e) {
    console.error('import_seed_sql failed', e);
    process.exit(1);
  }
})();
