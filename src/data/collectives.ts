// Parser for Parcels_collectives.json to extract "affectataires" using the logic
// translated from the provided Python script.

import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import databaseManager, { DatabaseManager } from './database';

// persistent cache table name
const CACHE_TABLE = 'collectives_cache';

// Use memory cache instead of global
const MEMORY_CACHE = new Map<string, any>();

// Note: do not synchronously require the prebuilt index at module import time
// because it can block the JS thread on start. The prebuilt index should be
// loaded dynamically from calling code when needed.

function openDb() {
  try {
    // match DatabaseManager DB name
    return (SQLite as any).openDatabaseSync ? (SQLite as any).openDatabaseSync('parcelapp.db') : (SQLite as any).openDatabase('parcelapp.db');
  } catch (e) {
    try {
      return (SQLite as any).openDatabaseSync ? (SQLite as any).openDatabaseSync('parcelapp.db') : (SQLite as any).openDatabase('parcelapp.db');
    } catch (err) {
      return null as any;
    }
  }
}

async function ensureCacheTable() {
  const db = (DatabaseManager as any).db;
  try {
    if (db && (db as any).execAsync) {
      await (db as any).execAsync(`CREATE TABLE IF NOT EXISTS ${CACHE_TABLE} (key TEXT PRIMARY KEY, value TEXT, updated INTEGER);`);
      return;
    }
  } catch (e) {
    // ignore and fallback
  }
  const local = openDb();
  if (!local) return;
  if (typeof (local as any).transaction === 'function') {
    (local as any).transaction((tx: any) => {
      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS ${CACHE_TABLE} (key TEXT PRIMARY KEY, value TEXT, updated INTEGER);`,
        [],
        () => {},
        () => true
      );
    });
  }
}

async function loadCacheFromDbIntoMemory(map: Map<string, any>) {
  // Use the imported singleton instance
  const db = databaseManager.db;
  try {
    if (db && (db as any).getAllAsync) {
      const rows = await (db as any).getAllAsync(`SELECT key, value FROM ${CACHE_TABLE};`, []);
      for (const r of rows || []) {
        try { 
          const parsed = JSON.parse(r.value);
          // Filter out any N/A or null values that shouldn't be displayed
          if (parsed && typeof parsed === 'object') {
            Object.keys(parsed).forEach(key => {
              if (parsed[key] === 'N/A' || parsed[key] === null || parsed[key] === undefined) {
                parsed[key] = ''; // Replace with empty string for better UI display
              }
            });
          }
          map.set(r.key, parsed); 
        } catch (e) {}
      }
      return;
    }
  } catch (e) {
    // fallback to local DB
  }
  const local = openDb();
  if (!local) return;
  if (typeof (local as any).transaction === 'function') {
    (local as any).transaction((tx: any) => {
      tx.executeSql(
        `SELECT key, value FROM ${CACHE_TABLE};`,
        [],
        (_: any, result: any) => {
          try {
            const rows = result && result.rows && result.rows._array ? result.rows._array : [];
            for (const r of rows) {
              try {
                const parsed = JSON.parse(r.value);
                // Filter out N/A values
                if (parsed && typeof parsed === 'object') {
                  Object.keys(parsed).forEach(key => {
                    if (parsed[key] === 'N/A' || parsed[key] === null || parsed[key] === undefined) {
                      parsed[key] = ''; // Replace with empty string
                    }
                  });
                }
                map.set(r.key, parsed);
              } catch (e) {}
            }
          } catch (e) {}
        },
        () => true
      );
    });
  }
}

function persistToDbAsync(key: string, value: any) {
  const json = JSON.stringify(value);
  const ts = Date.now();
  const db = (DatabaseManager as any).db;
  if (db && (db as any).runAsync) {
    try {
      (db as any).runAsync(`INSERT OR REPLACE INTO ${CACHE_TABLE} (key, value, updated) VALUES (?, ?, ?);`, [key, json, ts]).catch(() => {});
      return;
    } catch (e) {}
  }
  const local = openDb();
  if (!local) return;
  if (typeof (local as any).transaction === 'function') {
    (local as any).transaction((tx: any) => {
      tx.executeSql(
        `INSERT OR REPLACE INTO ${CACHE_TABLE} (key, value, updated) VALUES (?, ?, ?);`,
        [key, json, ts],
        () => {},
        () => true
      );
    });
  }
}

function cleanValue(value: any): string {
  if (value === null || value === undefined) return '-';
  let s = String(value);
  if (s === 'NaN' || s === 'nan') return '-';
  if (s.endsWith('.0')) s = s.slice(0, -2);
  return s.trim();
}

function getField(obj: any, key: string) {
  return obj && Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : undefined;
}

function mergeRecords(properties: any) {
  // Normalize keys: some data sources use a trailing _IND variant (e.g., Prenom_IND).
  // Prefer base names when present; otherwise map base -> _IND value so downstream logic can find fields.
  const normalizedProps: any = {};
  for (const k of Object.keys(properties || {})) {
    normalizedProps[k] = properties[k];
    if (k.endsWith('_IND')) {
      const base = k.replace(/_IND$/, '');
      if (normalizedProps[base] == null) normalizedProps[base] = properties[k];
    }
  }
  const availableColumns = Object.keys(normalizedProps || {});

  const prenoms: string[] = [];
  const noms: string[] = [];
  const sexes: string[] = [];
  const pieces: string[] = [];
  const telephones: string[] = [];
  const dates_naissance: string[] = [];
  const residences: string[] = [];

  // Mandataire (if present) -> keep as first entry
  if (availableColumns.includes('Prenom_M') && availableColumns.includes('Nom_M')) {
    const pm = getField(normalizedProps, 'Prenom_M');
    const nm = getField(normalizedProps, 'Nom_M');
    if (pm != null && nm != null) {
      prenoms.push(cleanValue(pm));
      noms.push(cleanValue(nm));
      const sexeM = getField(normalizedProps, 'Sexe_Mndt') ?? getField(normalizedProps, 'Sexe_M');
      sexes.push(sexeM != null ? cleanValue(sexeM) : '-');
      // mandataire piece/phone/date/residence (best-effort)
      pieces.push(getField(normalizedProps, 'Num_piec') != null ? cleanValue(getField(normalizedProps, 'Num_piec')) : (getField(normalizedProps, 'Num_piece') != null ? cleanValue(getField(normalizedProps, 'Num_piece')) : '-'));
      if (getField(normalizedProps, 'Telephon1') != null) telephones.push(cleanValue(getField(normalizedProps, 'Telephon1')));
      else if (getField(normalizedProps, 'Telephon2') != null) telephones.push(cleanValue(getField(normalizedProps, 'Telephon2')));
      else telephones.push('-');
      dates_naissance.push(getField(normalizedProps, 'Date_nai') != null ? cleanValue(getField(normalizedProps, 'Date_nai')) : '-');
      residences.push(getField(normalizedProps, 'Residence_M') != null ? cleanValue(getField(normalizedProps, 'Residence_M')) : (getField(normalizedProps, 'Residence') != null ? cleanValue(getField(normalizedProps, 'Residence')) : '-'));
    }
  }

  // Find affectataires by scanning Prenom / Prenom_* and Nom / Nom_*
  const affectataires: Record<string, { prenom?: string | null; nom?: string | null }> = {};
  for (const col of availableColumns) {
    const baseCol = col.replace(/_IND$/, '');
    if (baseCol === 'Prenom' || (baseCol.startsWith('Prenom_') && baseCol !== 'Prenom_M')) {
      let affectataire_id = baseCol.replace('Prenom_', '').replace('Prenom', '0');
      if (affectataire_id === '') affectataire_id = '0';
      if (!affectataires[affectataire_id]) affectataires[affectataire_id] = {};
      if (getField(normalizedProps, col) != null) affectataires[affectataire_id].prenom = cleanValue(getField(normalizedProps, col));
    } else if (baseCol === 'Nom' || (baseCol.startsWith('Nom_') && baseCol !== 'Nom_M')) {
      let affectataire_id = baseCol.replace('Nom_', '').replace('Nom', '0');
      if (affectataire_id === '') affectataire_id = '0';
      if (!affectataires[affectataire_id]) affectataires[affectataire_id] = {};
      if (getField(normalizedProps, col) != null) affectataires[affectataire_id].nom = cleanValue(getField(normalizedProps, col));
    }
  }

  // Process each affectataire according to the identifier rules
  for (const [affectataire_id, info] of Object.entries(affectataires)) {
    if (info.prenom && info.nom) {
      const mandPren = cleanValue(getField(normalizedProps, 'Prenom_M'));
      const mandNom = cleanValue(getField(normalizedProps, 'Nom_M'));
      const prArr = String(info.prenom).split(/\r?\n/).map((s) => s.trim()).filter(Boolean).map(cleanValue);
      const nmArr = String(info.nom).split(/\r?\n/).map((s) => s.trim()).filter(Boolean).map(cleanValue);
      const count = Math.max(prArr.length, nmArr.length);
      for (let j = 0; j < count; j++) {
        const pName = prArr[j] || '-';
        const nName = nmArr[j] || '-';
        if (pName === '-' && nName === '-') continue;
        if (pName !== mandPren || nName !== mandNom) {
          prenoms.push(pName);
          noms.push(nName);
          sexes.push('-');
          pieces.push('-');
          telephones.push('-');
          dates_naissance.push('-');
          residences.push('-');
        }
      }
    }
    // Note: for this simplified parser we only extract prenom/nom (newline or indexed).
    // Detailed per-affectataire metadata extraction is intentionally omitted here to
    // keep the parser robust for unit tests that validate name aggregation.
  }

  if (prenoms.length === 0 || prenoms.length < 2) {
    // not enough affectataires — skip
    return null;
  }

  // Build merged object
  const merged: any = {
    Prenom: prenoms.join('\n'),
    Nom: noms.join('\n'),
    Sexe: sexes.join('\n'),
    Numero_piece: pieces.join('\n'),
    Telephone: telephones.join('\n'),
    Date_naissance: dates_naissance.join('\n'),
    Residence: residences.join('\n'),
  };

  // attach some metadata if present
  merged.nicad = getField(properties, 'nicad') ?? getField(properties, 'nicad_parc') ?? '';
  merged.Num_parcel_2 = getField(properties, 'Num_parcel_2') ?? '';
  merged.superficie = getField(properties, 'superficie') ?? '';
  merged.Village = getField(properties, 'Village') ?? '';
  merged.Vocation_1 = getField(properties, 'Vocation_1') ?? '';
  merged.type_usa = getField(properties, 'type_usa') ?? '';

  return merged;
}

export function parseCollectives(raw: any): any[] {
  const features = Array.isArray(raw) ? raw : raw.features || [];
  // simple in-memory cache keyed by parcel key -> combined object
  // keep this module-level so subsequent imports reuse the cache
  // attempt to load persisted cache into memory (non-blocking)
  try {
    if (MEMORY_CACHE.size === 0) {
      ensureCacheTable().catch(() => {});
      loadCacheFromDbIntoMemory(MEMORY_CACHE).catch?.(() => {});
    }
  } catch (e) {}
  const CACHE = MEMORY_CACHE;

  // Group features by parcel number so we can merge affectataires across records
  const groups: Record<string, any[]> = {};
  for (const f of features) {
    const props = f && f.properties ? f.properties : f;
    if (!props) continue;
    // prefer canonical Num_parcel, fallback to variants
    const key = (props.Num_parcel || props.Num_parcel_2 || props.Num_parcelle || props.Num_parc || props.num_parcel || props.num_parcelle || props.id || String(props.fid || ''));
    if (!groups[key]) groups[key] = [];
    groups[key].push(props);
  }

  const results: any[] = [];

  // For each parcel group, parse each record and then combine the parsed affectataires
  for (const [parcelKey, propsArr] of Object.entries(groups)) {
    // return cached combined result for this parcel key if available
    if (CACHE.has(parcelKey)) {
      const cached = CACHE.get(parcelKey);
      if (cached) results.push(cached);
      continue;
    }
    const parsedList: any[] = [];
    for (const props of propsArr) {
      try {
        const p = mergeRecords(props);
        if (p) parsedList.push(p);
      } catch (e) {
        // ignore parse errors for individual records
      }
    }

    // Debug: when running under tests, surface parsedList length to help diagnosing failures
    try {
      if (typeof console !== 'undefined' && (Platform as any)?.OS === 'android') {
        // eslint-disable-next-line no-console
        console.log('DEBUG parseCollectives parcelKey', parcelKey, 'parsedList.length=', parsedList.length, 'sample=', parsedList[0]);
      }
    } catch (e) {}

    if (parsedList.length === 0) continue;

    // Combine parsed entries by concatenating lines and removing exact duplicates while
    // preserving order. We also attempt to dedupe by combined prenom+nom pairs.
    const combined: any = {};
    const fields = ['Prenom', 'Nom', 'Sexe', 'Numero_piece', 'Telephone', 'Date_naissance', 'Residence'];

    // helper to split lines, trim, and filter empty
    const splitLines = (v: any) => (v == null ? [] : String(v).split(/\r?\n/).map((s) => s.trim()).filter((s) => s && s !== '-'));

    // collect per-field ordered lists
    const fieldLists: Record<string, string[]> = {};
    for (const f of fields) fieldLists[f] = [];

    for (const item of parsedList) {
      for (const f of fields) {
        const parts = splitLines(item[f]);
        for (const part of parts) fieldLists[f].push(part);
      }
    }

    // dedupe by prenom+nom pairs if possible
    const pairs: string[] = [];
    const finalPrenoms: string[] = [];
    const finalNoms: string[] = [];
    const maxLen = Math.max(fieldLists['Prenom'].length, fieldLists['Nom'].length);
    for (let i = 0; i < maxLen; i++) {
      const pr = fieldLists['Prenom'][i] || '-';
      const nm = fieldLists['Nom'][i] || '-';
      const keyPair = `${pr}||${nm}`;
      if (pairs.includes(keyPair)) continue;
      pairs.push(keyPair);
      finalPrenoms.push(pr);
      finalNoms.push(nm);
    }

    combined.Prenom = finalPrenoms.join('\n');
    combined.Nom = finalNoms.join('\n');

    // For the rest of the fields, dedupe preserving order and align lengths with prenom/nom if possible
    for (const f of ['Sexe', 'Numero_piece', 'Telephone', 'Date_naissance', 'Residence']) {
      const uniq: string[] = [];
      for (const v of fieldLists[f]) {
        if (!uniq.includes(v)) uniq.push(v);
      }
      // if counts differ, pad with '-' to match number of names
      while (uniq.length < finalPrenoms.length) uniq.push('-');
      combined[f] = uniq.slice(0, Math.max(uniq.length, finalPrenoms.length)).join('\n');
    }

    // attach metadata from the first properties object in the group
    const meta = propsArr[0] || {};
    combined.nicad = meta.nicad ?? meta.nicad_parc ?? '';
    combined.Num_parcel_2 = meta.Num_parcel_2 ?? '';
    combined.Num_parcel = meta.Num_parcel ?? '';
    combined.superficie = meta.superficie ?? '';
    combined.Village = meta.Village ?? '';
    combined.Vocation_1 = meta.Vocation_1 ?? '';
    combined.type_usa = meta.type_usa ?? '';

    // only include groups with at least 2 affectataires
    const totalNames = combined.Prenom ? splitLines(combined.Prenom).length : 0;
    if (totalNames >= 2) {
      results.push(combined);
      // populate in-memory cache
      try {
        CACHE.set(parcelKey, combined);
        // persist asynchronously
        setTimeout(() => persistToDbAsync(parcelKey, combined), 0);
      } catch (e) {
        // ignore cache set failures
      }
    }
  }

  return results;
}

export default { parseCollectives };
