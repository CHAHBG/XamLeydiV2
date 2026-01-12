import React, { useMemo, useRef, useState } from 'react';
import { iterateFeaturesFromGeoJSONL } from './geojsonl';
import { createIndices, createParcelDb, createSchema, exportDb, prepareInsertStatements } from './db';
import { canonicalizeProperties } from './canonicalize';

type Phase = 'idle' | 'running' | 'done' | 'error';

function formatBytes(n: number) {
  if (!Number.isFinite(n)) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function downloadBytes(bytes: Uint8Array, filename: string, mime = 'application/x-sqlite3') {
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function App() {
  const [individualFile, setIndividualFile] = useState<File | null>(null);
  const [collectiveFile, setCollectiveFile] = useState<File | null>(null);

  const [phase, setPhase] = useState<Phase>('idle');
  const [message, setMessage] = useState<string>('');

  const [indStats, setIndStats] = useState({ bytesRead: 0, totalBytes: 0, lines: 0, features: 0 });
  const [colStats, setColStats] = useState({ bytesRead: 0, totalBytes: 0, lines: 0, features: 0 });

  const [insertedInd, setInsertedInd] = useState(0);
  const [insertedCol, setInsertedCol] = useState(0);

  const abortRef = useRef<AbortController | null>(null);

  const canRun = useMemo(() => !!individualFile && !!collectiveFile && phase !== 'running', [individualFile, collectiveFile, phase]);

  const run = async () => {
    if (!individualFile || !collectiveFile) return;

    setPhase('running');
    setMessage('Initializing database...');
    setIndStats({ bytesRead: 0, totalBytes: individualFile.size, lines: 0, features: 0 });
    setColStats({ bytesRead: 0, totalBytes: collectiveFile.size, lines: 0, features: 0 });
    setInsertedInd(0);
    setInsertedCol(0);

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const db = await createParcelDb();
      createSchema(db);
      const { insertInd, insertCol } = prepareInsertStatements(db);

      setMessage('Inserting individual parcels...');
      db.run('BEGIN;');
      let indInserted = 0;
      let indUiTick = 0;
      for await (const f of iterateFeaturesFromGeoJSONL(individualFile, {
        signal: abort.signal,
        onProgress: (p) => setIndStats(p),
      })) {
        const p0 = (f.properties ?? {}) as Record<string, any>;
        const cp = canonicalizeProperties(p0) ?? p0;
        const numParcel = cp.Num_parcel ?? cp.num_parcel ?? cp.numero_parcelle ?? null;
        const typPers = cp.Typ_pers ?? cp.typ_pers ?? null;
        const prenom = cp.Prenom ?? cp.prenom ?? null;
        const nom = cp.Nom ?? cp.nom ?? null;
        const denominat = cp.Denominat ?? cp.denominat ?? null;
        const village = cp.Village ?? cp.village ?? null;
        let geometry = '{}';
        let properties = '{}';
        try { geometry = JSON.stringify(f.geometry ?? {}); } catch {}
        try { properties = JSON.stringify(cp); } catch {}

        insertInd.run([numParcel, typPers, prenom, nom, denominat, village, geometry, properties]);

        indInserted += 1;
        indUiTick += 1;
        if (indUiTick >= 500) {
          indUiTick = 0;
          setInsertedInd(indInserted);
        }
      }
      db.run('COMMIT;');
      setInsertedInd(indInserted);

      setMessage('Inserting collective parcels...');
      db.run('BEGIN;');
      let colInserted = 0;
      let colUiTick = 0;
      for await (const f of iterateFeaturesFromGeoJSONL(collectiveFile, {
        signal: abort.signal,
        onProgress: (p) => setColStats(p),
      })) {
        const p0 = (f.properties ?? {}) as Record<string, any>;
        const cp = canonicalizeProperties(p0) ?? p0;
        const numParcel = cp.Num_parcel ?? cp.num_parcel ?? cp.numero_parcelle ?? null;
        const typPers = cp.Typ_pers ?? cp.typ_pers ?? null;
        const prenomM = cp.Prenom_M ?? cp.prenom_m ?? null;
        const nomM = cp.Nom_M ?? cp.nom_m ?? null;
        const denominat = cp.Denominat ?? cp.denominat ?? null;
        const village = cp.Village ?? cp.village ?? null;
        let geometry = '{}';
        let properties = '{}';
        try { geometry = JSON.stringify(f.geometry ?? {}); } catch {}
        try { properties = JSON.stringify(cp); } catch {}

        insertCol.run([numParcel, typPers, prenomM, nomM, denominat, village, geometry, properties]);

        colInserted += 1;
        colUiTick += 1;
        if (colUiTick >= 500) {
          colUiTick = 0;
          setInsertedCol(colInserted);
        }
      }
      db.run('COMMIT;');
      setInsertedCol(colInserted);

      setMessage('Creating indices...');
      createIndices(db);

      setMessage('Exporting database...');
      const bytes = exportDb(db);
      downloadBytes(bytes, 'parcelapp.db');

      setMessage('Done. Downloaded parcelapp.db');
      setPhase('done');
    } catch (e: any) {
      setPhase('error');
      setMessage(String(e?.message ?? e));
    } finally {
      abortRef.current = null;
    }
  };

  const cancel = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setPhase('idle');
    setMessage('Cancelled.');
  };

  return (
    <div style={{ fontFamily: 'system-ui, Segoe UI, Arial', padding: 20, maxWidth: 880, margin: '0 auto' }}>
      <h1 style={{ marginBottom: 8 }}>ParcelApp DB Preparation</h1>
      <p style={{ marginTop: 0, color: '#444' }}>
        Upload 2 GeoJSONL files (individuels + collectives). The app will normalize and generate a SQLite DB (parcelapp.db)
        for the mobile app.
      </p>

      <div style={{ display: 'grid', gap: 14 }}>
        <div style={{ display: 'grid', gap: 6 }}>
          <label><b>Individuels (.geojsonl)</b></label>
          <input
            type="file"
            accept=".geojsonl,.jsonl,application/json,text/plain"
            onChange={(e) => setIndividualFile(e.target.files?.[0] ?? null)}
          />
          {individualFile && (
            <small style={{ color: '#555' }}>
              {individualFile.name} · {formatBytes(individualFile.size)}
            </small>
          )}
        </div>

        <div style={{ display: 'grid', gap: 6 }}>
          <label><b>Collectives (.geojsonl)</b></label>
          <input
            type="file"
            accept=".geojsonl,.jsonl,application/json,text/plain"
            onChange={(e) => setCollectiveFile(e.target.files?.[0] ?? null)}
          />
          {collectiveFile && (
            <small style={{ color: '#555' }}>
              {collectiveFile.name} · {formatBytes(collectiveFile.size)}
            </small>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={run} disabled={!canRun} style={{ padding: '10px 14px' }}>
            Generate parcelapp.db
          </button>
          <button onClick={cancel} disabled={phase !== 'running'} style={{ padding: '10px 14px' }}>
            Cancel
          </button>
          <span style={{ color: phase === 'error' ? '#b00020' : '#333' }}>{message}</span>
        </div>

        <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>Progress</h3>
          <div style={{ display: 'grid', gap: 10 }}>
            <div>
              <b>Individuels</b>
              <div style={{ color: '#555' }}>
                Read: {formatBytes(indStats.bytesRead)} / {formatBytes(indStats.totalBytes)} · Lines: {indStats.lines} · Features: {indStats.features} · Inserted: {insertedInd}
              </div>
            </div>
            <div>
              <b>Collectives</b>
              <div style={{ color: '#555' }}>
                Read: {formatBytes(colStats.bytesRead)} / {formatBytes(colStats.totalBytes)} · Lines: {colStats.lines} · Features: {colStats.features} · Inserted: {insertedCol}
              </div>
            </div>
          </div>

          <p style={{ marginBottom: 0, color: '#555' }}>
            Output: <code>parcelapp.db</code> will download automatically when finished.
          </p>
        </div>

        <div style={{ color: '#666', fontSize: 13, lineHeight: 1.4 }}>
          <b>Next step (mobile app):</b> copy the downloaded <code>parcelapp.db</code> into
          <code> android/app/src/main/assets/parcelapp.db</code> before building the APK.
        </div>
      </div>
    </div>
  );
}
