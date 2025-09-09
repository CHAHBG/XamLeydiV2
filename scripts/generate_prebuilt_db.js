const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const out = path.resolve(__dirname, '..', 'prebuilt', 'parcelapp.db');
const fs = require('fs');
function loadJsonPreferPrebuilt(name) {
  const pre = path.resolve(__dirname, '..', 'prebuilt', name);
  const src = path.resolve(__dirname, '..', 'src', 'data', name);
  if (fs.existsSync(pre)) return require(pre);
  if (fs.existsSync(src)) return require(src);
  return [];
}

const individuals = loadJsonPreferPrebuilt('Parcels_individuels.json');
const collectives = loadJsonPreferPrebuilt('Parcels_collectives.json');

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

ensureDir(path.dirname(out));
if (fs.existsSync(out)) fs.unlinkSync(out);

const db = new Database(out);

try {
  db.exec(`PRAGMA journal_mode = OFF;`);
  db.exec(`PRAGMA synchronous = OFF;`);

  db.exec(`CREATE TABLE parcels (
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

  db.exec(`CREATE INDEX idx_parcels_num_parcel ON parcels(num_parcel);`);

  const insert = db.prepare(`INSERT INTO parcels (num_parcel, parcel_type, typ_pers, prenom, nom, prenom_m, nom_m, denominat, village, geometry, properties) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insertMany = db.transaction((rows) => {
    for (const r of rows) insert.run(r);
  });

  const indRows = (Array.isArray(individuals) ? individuals : []).map(f => [
    f.properties?.Num_parcel || null,
    'individuel',
    f.properties?.Typ_pers || null,
    f.properties?.Prenom || null,
    f.properties?.Nom || null,
    null,
    null,
    f.properties?.Denominat || null,
    f.properties?.Village || null,
    JSON.stringify(f.geometry),
    JSON.stringify(f.properties)
  ]);

  insertMany(indRows);

  const colRows = (Array.isArray(collectives) ? collectives : []).map(f => [
    f.properties?.Num_parcel || null,
    'collectif',
    f.properties?.Typ_pers || null,
    null,
    null,
    f.properties?.Prenom_M || null,
    f.properties?.Nom_M || null,
    f.properties?.Denominat || null,
    f.properties?.Village || null,
    JSON.stringify(f.geometry),
    JSON.stringify(f.properties)
  ]);

  insertMany(colRows);

  console.log('Prebuilt DB written to', out);
} finally {
  db.close();
}
