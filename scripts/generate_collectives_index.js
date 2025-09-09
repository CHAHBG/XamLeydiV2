/*
 Small node script to generate a compact prebuilt index `prebuilt/collectives_index.json`
 mapping parcelKey -> merged object with fields used by the app (Prenom, Nom, Sexe,
 Numero_piece, Telephone, Date_naissance, Residence).

 Run: node scripts/generate_collectives_index.js
*/
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'src', 'data', 'Parcels_collectives.json');
const outDir = path.join(__dirname, '..', 'prebuilt');
const outFile = path.join(outDir, 'collectives_index.json');

if (!fs.existsSync(src)) {
  console.error('Source file not found:', src);
  process.exit(1);
}

console.log('Reading source:', src);
const raw = fs.readFileSync(src, 'utf8');
let arr = [];
try {
  arr = JSON.parse(raw);
} catch (e) {
  // try to treat file as FeatureCollection
  try {
    const j = JSON.parse(raw);
    arr = j.features || j;
  } catch (ee) {
    console.error('Failed to parse JSON:', ee);
    process.exit(1);
  }
}

// naive reuse of the mergeRecords logic tailored to produce same shape
function cleanValue(v) {
  if (v === null || v === undefined) return '-';
  let s = String(v);
  if (s === 'NaN' || s === 'nan') return '-';
  if (s.endsWith('.0')) s = s.slice(0, -2);
  return s.trim();
}

function getField(o,k){ return o && Object.prototype.hasOwnProperty.call(o,k) ? o[k] : undefined; }

function mergeRecords(properties) {
  const normalized = {};
  Object.keys(properties || {}).forEach(k => {
    normalized[k] = properties[k];
    if (k.endsWith('_IND')) {
      const base = k.replace(/_IND$/, '');
      if (normalized[base] == null) normalized[base] = properties[k];
    }
  });
  const available = Object.keys(normalized || {});
  const prenoms = [];
  const noms = [];
  const sexes = [];
  const pieces = [];
  const telephones = [];
  const dates = [];
  const residences = [];
  if (available.includes('Prenom_M') && available.includes('Nom_M')) {
    const pm = getField(normalized, 'Prenom_M');
    const nm = getField(normalized, 'Nom_M');
    if (pm != null && nm != null) {
      prenoms.push(cleanValue(pm));
      noms.push(cleanValue(nm));
      const sexeM = getField(normalized, 'Sexe_Mndt') ?? getField(normalized, 'Sexe_M');
      sexes.push(sexeM != null ? cleanValue(sexeM) : '-');
      pieces.push(getField(normalized, 'Num_piec') != null ? cleanValue(getField(normalized, 'Num_piec')) : (getField(normalized, 'Num_piece') != null ? cleanValue(getField(normalized, 'Num_piece')) : '-'));
      if (getField(normalized, 'Telephon1') != null) telephones.push(cleanValue(getField(normalized, 'Telephon1')));
      else if (getField(normalized, 'Telephon2') != null) telephones.push(cleanValue(getField(normalized, 'Telephon2')));
      else telephones.push('-');
      dates.push(getField(normalized, 'Date_nai') != null ? cleanValue(getField(normalized, 'Date_nai')) : '-');
      residences.push(getField(normalized, 'Residence_M') != null ? cleanValue(getField(normalized, 'Residence_M')) : (getField(normalized, 'Residence') != null ? cleanValue(getField(normalized, 'Residence')) : '-'));
    }
  }

  // minimal aggregation for other affectataires: scan Prenom_* and Nom_*
  const affectataires = {};
  for (const col of available) {
    const base = col.replace(/_IND$/, '');
    if (base === 'Prenom' || (base.startsWith('Prenom_') && base !== 'Prenom_M')) {
      let id = base.replace('Prenom_', '').replace('Prenom','0');
      if (id === '') id = '0';
      if (!affectataires[id]) affectataires[id] = {};
      if (getField(normalized, col) != null) affectataires[id].prenom = cleanValue(getField(normalized, col));
    } else if (base === 'Nom' || (base.startsWith('Nom_') && base !== 'Nom_M')) {
      let id = base.replace('Nom_', '').replace('Nom','0');
      if (id === '') id = '0';
      if (!affectataires[id]) affectataires[id] = {};
      if (getField(normalized, col) != null) affectataires[id].nom = cleanValue(getField(normalized, col));
    }
  }

  for (const [id,info] of Object.entries(affectataires)) {
    if (info.prenom && info.nom) {
      const prArr = String(info.prenom).split(/\r?\n/).map(s=>s.trim()).filter(Boolean).map(cleanValue);
      const nmArr = String(info.nom).split(/\r?\n/).map(s=>s.trim()).filter(Boolean).map(cleanValue);
      const count = Math.max(prArr.length, nmArr.length);
      for (let j=0;j<count;j++) {
        const pName = prArr[j]||'-';
        const nName = nmArr[j]||'-';
        if (pName === '-' && nName === '-') continue;
        prenoms.push(pName);
        noms.push(nName);
        sexes.push('-'); pieces.push('-'); telephones.push('-'); dates.push('-'); residences.push('-');
      }
    }
  }

  if (prenoms.length === 0 || prenoms.length < 2) return null;
  const merged = {
    Prenom: prenoms.join('\n'),
    Nom: noms.join('\n'),
    Sexe: sexes.join('\n'),
    Numero_piece: pieces.join('\n'),
    Telephone: telephones.join('\n'),
    Date_naissance: dates.join('\n'),
    Residence: residences.join('\n')
  };
  merged.nicad = getField(properties, 'nicad') ?? getField(properties, 'nicad_parc') ?? '';
  merged.Num_parcel_2 = getField(properties, 'Num_parcel_2') ?? '';
  merged.Num_parcel = getField(properties, 'Num_parcel') ?? '';
  merged.superficie = getField(properties, 'superficie') ?? '';
  merged.Village = getField(properties, 'Village') ?? '';
  merged.Vocation_1 = getField(properties, 'Vocation_1') ?? '';
  merged.type_usa = getField(properties, 'type_usa') ?? '';

  return merged;
}

const groups = {};
for (const f of arr) {
  const props = f && f.properties ? f.properties : f;
  if (!props) continue;
  const key = (props.Num_parcel || props.Num_parcel_2 || props.Num_parcelle || props.Num_parc || props.num_parcel || props.num_parcelle || props.id || String(props.fid || ''));
  if (!key) continue;
  if (!groups[key]) groups[key] = [];
  groups[key].push(props);
}

const out = {};
for (const [k, propsArr] of Object.entries(groups)) {
  const parsedList = [];
  for (const p of propsArr) {
    try {
      const m = mergeRecords(p);
      if (m) parsedList.push(m);
    } catch (e) {}
  }
  if (parsedList.length === 0) continue;
  // combine similar to parseCollectives
  const fields = ['Prenom','Nom','Sexe','Numero_piece','Telephone','Date_naissance','Residence'];
  const splitLines = v => (v==null?[]:String(v).split(/\r?\n/).map(s=>s.trim()).filter(Boolean));
  const fieldLists = {};
  for (const f of fields) fieldLists[f] = [];
  for (const item of parsedList) {
    for (const f of fields) {
      const parts = splitLines(item[f]);
      for (const part of parts) fieldLists[f].push(part);
    }
  }
  const uniqLists = {};
  for (const f of fields) {
    const uniq = [];
    for (const v of fieldLists[f]) if (!uniq.includes(v)) uniq.push(v);
    uniqLists[f] = uniq;
  }
  // pad lists
  const maxNames = Math.max(uniqLists['Prenom'].length, uniqLists['Nom'].length);
  if (maxNames < 2) continue;
  for (const f of fields) while (uniqLists[f].length < maxNames) uniqLists[f].push('-');
  const combined = {};
  for (const f of fields) combined[f] = uniqLists[f].slice(0, maxNames).join('\n');
  combined.Prenom = combined.Prenom || '';
  combined.Nom = combined.Nom || '';
  combined.Sexe = combined.Sexe || '';
  combined.Numero_piece = combined.Numero_piece || '';
  combined.Telephone = combined.Telephone || '';
  combined.Date_naissance = combined.Date_naissance || '';
  combined.Residence = combined.Residence || '';
  // metadata from first
  const meta = propsArr[0] || {};
  combined.nicad = meta.nicad ?? meta.nicad_parc ?? '';
  combined.Num_parcel_2 = meta.Num_parcel_2 ?? '';
  combined.Num_parcel = meta.Num_parcel ?? '';
  combined.superficie = meta.superficie ?? '';
  combined.Village = meta.Village ?? '';
  combined.Vocation_1 = meta.Vocation_1 ?? '';
  combined.type_usa = meta.type_usa ?? '';

  out[k] = combined;
}

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(out, null, 2), 'utf8');
console.log('Wrote prebuilt index to', outFile);
