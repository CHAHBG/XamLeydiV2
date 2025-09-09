const path = require('path');
const sqlite3 = require('sqlite3').verbose();

(async () => {
  try {
    const dbPath = path.join(__dirname, '..', 'prebuilt', 'parcelapp.db');
    console.log('Opening DB at', dbPath);
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        console.error('Failed to open DB:', err.message);
        process.exit(1);
      }
    });

    db.serialize(() => {
      db.get('SELECT COUNT(*) as count FROM parcels', (err, row) => {
        if (err) {
          console.error('COUNT query failed:', err.message);
        } else {
          console.log('parcels row count:', row && row.count);
        }
      });

      console.log('\nSample rows (5):');
      db.all('SELECT id, num_parcel, parcel_type, nom, prenom, village FROM parcels ORDER BY id LIMIT 5', (err, rows) => {
        if (err) {
          console.error('Sample query failed:', err.message);
        } else {
          console.log(JSON.stringify(rows, null, 2));
        }
        db.close();
      });
    });
  } catch (e) {
    console.error('smoke_query failed', e);
    process.exit(1);
  }
})();
