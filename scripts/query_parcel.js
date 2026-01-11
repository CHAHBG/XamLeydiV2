const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.resolve(__dirname, '..', 'prebuilt', 'parcelapp.db');
const db = new Database(dbPath, { readonly: true });
const num = process.argv[2] || '0522010201354';
const row = db.prepare('SELECT id, num_parcel, parcel_type, geometry, properties FROM parcels WHERE num_parcel = ? LIMIT 1').get(num);
console.log('Querying:', num);
if (!row) { console.log('Not found'); process.exit(0); }
try { row.properties = JSON.parse(row.properties); } catch (e) {}
try { row.geometry = JSON.parse(row.geometry); } catch (e) {}
console.log(JSON.stringify(row, null, 2));
db.close();
