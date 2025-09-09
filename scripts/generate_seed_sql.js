const fs = require('fs');
const path = require('path');

// This script reads Parcels_individuels.json and Parcels_collectives.json from src/data
// and emits an SQL file with INSERT statements at prebuilt/seed_parcels.sql

const dataDir = path.join(__dirname, '..', 'src', 'data');
const outDir = path.join(__dirname, '..', 'prebuilt');

function escapeSqlString(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/'/g, "''");
}

function shapeProps(obj) {
  try { return JSON.stringify(obj).replace(/'/g, "''"); } catch (e) { return '' }
}

function makeInsert(row) {
  // Ensure columns: num_parcel, parcel_type, typ_pers, prenom, nom, prenom_m, nom_m, denominat, village, geometry, properties
  const vals = [
    escapeSqlString(row.num_parcel || row.Num_parcel || ''),
    escapeSqlString(row.parcel_type || row.parcelType || ''),
    escapeSqlString(row.typ_pers || ''),
    escapeSqlString(row.prenom || ''),
    escapeSqlString(row.nom || ''),
    escapeSqlString(row.prenom_m || row.Prenom_M || ''),
    escapeSqlString(row.nom_m || row.Nom_M || ''),
    escapeSqlString(row.denominat || ''),
    escapeSqlString(row.village || ''),
    shapeProps(row.geometry || {}),
    shapeProps(row.properties || row)
  ];

  return `INSERT INTO parcels (num_parcel, parcel_type, typ_pers, prenom, nom, prenom_m, nom_m, denominat, village, geometry, properties) VALUES ('${vals.join("', '")}');`;
}

(async function main(){
  try {
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const indivPath = path.join(dataDir, 'Parcels_individuels.json');
    const collPath = path.join(dataDir, 'Parcels_collectives.json');

    let indiv = [];
    let coll = [];
    try { indiv = JSON.parse(fs.readFileSync(indivPath, 'utf8')); } catch (e) { console.error('Failed to read individuels:', e); }
    try { coll = JSON.parse(fs.readFileSync(collPath, 'utf8')); } catch (e) { console.error('Failed to read collectifs:', e); }

    const outPath = path.join(outDir, 'seed_parcels.sql');
    const header = `-- Generated seed SQL; run with sqlite3 parcelapp.db < seed_parcels.sql\nBEGIN TRANSACTION;\n`;
    const footer = '\nCOMMIT;\n';
    const statements = [];

    for (const f of (indiv || [])) {
      const props = f.properties || f;
      const geometry = f.geometry || {};
      const row = {
        num_parcel: props.Num_parcel || props.num_parcel || '',
        parcel_type: 'individuel',
        typ_pers: props.Typ_pers || props.typ_pers || '',
        prenom: props.Prenom || props.prenom || '',
        nom: props.Nom || props.nom || '',
        prenom_m: null,
        nom_m: null,
        denominat: props.Denominat || props.denominat || '',
        village: props.Village || props.village || '',
        geometry,
        properties: props
      };
      statements.push(makeInsert(row));
    }

    for (const f of (coll || [])) {
      const props = f.properties || f;
      const geometry = f.geometry || {};
      const row = {
        num_parcel: props.Num_parcel || props.num_parcel || '',
        parcel_type: 'collectif',
        typ_pers: props.Typ_pers || props.typ_pers || '',
        prenom: null,
        nom: null,
        prenom_m: props.Prenom_M || props.prenom_m || '',
        nom_m: props.Nom_M || props.nom_m || '',
        denominat: props.Denominat || props.denominat || '',
        village: props.Village || props.village || '',
        geometry,
        properties: props
      };
      statements.push(makeInsert(row));
    }

    fs.writeFileSync(outPath, header + statements.join('\n') + footer, 'utf8');
    console.log('Wrote', statements.length, 'INSERTs to', outPath);
  } catch (e) {
    console.error('generate_seed_sql failed', e);
    process.exit(1);
  }
})();
