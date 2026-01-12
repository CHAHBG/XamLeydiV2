// Important: use the browser/wasm build explicitly. Some bundlers may otherwise
// pull a node-ish build that references fs/path/crypto.
import initSqlJs from 'sql.js/dist/sql-wasm.js';
// Let Vite copy the wasm into /dist and give us its URL.
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import type { Database } from 'sql.js';
import type { GeoJSONFeature } from './types';
import { canonicalizeProperties } from './canonicalize';

export type BuildProgress = {
  phase: 'init' | 'schema' | 'insert' | 'index' | 'export';
  insertedIndividuals: number;
  insertedCollectives: number;
};

function jsonStringifySafe(value: any): string {
  try {
    return JSON.stringify(value ?? {});
  } catch {
    return '{}';
  }
}

export async function createParcelDb(): Promise<Database> {
  const SQL = await initSqlJs({
    locateFile: (file) => {
      // sql.js will ask for 'sql-wasm.wasm'
      if (file.endsWith('.wasm')) return wasmUrl;
      return file;
    },
  });

  const db = new SQL.Database();
  return db;
}

export function createSchema(db: Database) {
  db.run(`PRAGMA synchronous = OFF;`);
  db.run(`PRAGMA journal_mode = OFF;`);

  db.run(`CREATE TABLE parcels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    num_parcel TEXT COLLATE NOCASE,
    parcel_type TEXT,
    typ_pers TEXT,
    prenom TEXT,
    nom TEXT,
    prenom_m TEXT,
    nom_m TEXT,
    denominat TEXT,
    village TEXT COLLATE NOCASE,
    geometry TEXT,
    properties TEXT
  );`);
}

export function prepareInsertStatements(db: Database) {
  const insertInd = db.prepare(
    `INSERT INTO parcels (num_parcel, parcel_type, typ_pers, prenom, nom, prenom_m, nom_m, denominat, village, geometry, properties)
     VALUES (?, 'individuel', ?, ?, ?, NULL, NULL, ?, ?, ?, ?);`
  );

  const insertCol = db.prepare(
    `INSERT INTO parcels (num_parcel, parcel_type, typ_pers, prenom, nom, prenom_m, nom_m, denominat, village, geometry, properties)
     VALUES (?, 'collectif', ?, NULL, NULL, ?, ?, ?, ?, ?, ?);`
  );

  return { insertInd, insertCol };
}

export function createIndices(db: Database) {
  db.run(`CREATE INDEX idx_num_parcel ON parcels(num_parcel);`);
  db.run(`CREATE INDEX idx_village ON parcels(village);`);
  db.run(`CREATE INDEX idx_parcel_type ON parcels(parcel_type);`);
}

export function insertIndividual(db: Database, feature: GeoJSONFeature) {
  const p0 = (feature.properties ?? {}) as Record<string, any>;
  const props = canonicalizeProperties(p0) ?? p0;

  const numParcel = props.Num_parcel ?? props.num_parcel ?? props.numero_parcelle ?? null;
  const typPers = props.Typ_pers ?? props.typ_pers ?? null;
  const prenom = props.Prenom ?? props.prenom ?? null;
  const nom = props.Nom ?? props.nom ?? null;
  const denominat = props.Denominat ?? props.denominat ?? null;
  const village = props.Village ?? props.village ?? null;

  const geometry = jsonStringifySafe(feature.geometry ?? {});
  const properties = jsonStringifySafe(props);

  // Fallback path (slower): kept for compatibility if caller doesn't use prepared statements
  db.run(
    `INSERT INTO parcels (num_parcel, parcel_type, typ_pers, prenom, nom, prenom_m, nom_m, denominat, village, geometry, properties)
     VALUES (?, 'individuel', ?, ?, ?, NULL, NULL, ?, ?, ?, ?);`,
    [numParcel, typPers, prenom, nom, denominat, village, geometry, properties]
  );
}

export function insertCollective(db: Database, feature: GeoJSONFeature) {
  const p0 = (feature.properties ?? {}) as Record<string, any>;
  const props = canonicalizeProperties(p0) ?? p0;

  const numParcel = props.Num_parcel ?? props.num_parcel ?? props.numero_parcelle ?? null;
  const typPers = props.Typ_pers ?? props.typ_pers ?? null;
  const prenomM = props.Prenom_M ?? props.prenom_m ?? null;
  const nomM = props.Nom_M ?? props.nom_m ?? null;
  const denominat = props.Denominat ?? props.denominat ?? null;
  const village = props.Village ?? props.village ?? null;

  const geometry = jsonStringifySafe(feature.geometry ?? {});
  const properties = jsonStringifySafe(props);

  // Fallback path (slower): kept for compatibility if caller doesn't use prepared statements
  db.run(
    `INSERT INTO parcels (num_parcel, parcel_type, typ_pers, prenom, nom, prenom_m, nom_m, denominat, village, geometry, properties)
     VALUES (?, 'collectif', ?, NULL, NULL, ?, ?, ?, ?, ?, ?);`,
    [numParcel, typPers, prenomM, nomM, denominat, village, geometry, properties]
  );
}

export function exportDb(db: Database): Uint8Array {
  return db.export();
}
