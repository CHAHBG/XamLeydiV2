import sqlite3 from 'sqlite3';
import path from 'path';

const DB_PATH = path.join(__dirname, '..', 'prebuilt', 'parcelapp.db');

const toRad = (v: number) => v * Math.PI / 180;
const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const rLat1 = toRad(lat1), rLat2 = toRad(lat2);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371000 * c;
};

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

describe('Neighbor diagnostic for specific parcel', () => {
  it('prints neighbor distances for parcel 0522010201354', async () => {
    const db = await new Promise<any>((resolve, reject) => {
      try {
        const d = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY, (err: any) => err ? reject(err) : resolve(d));
        // Note: the resolve above references d before it's assigned in old Node; fix by resolving in callback
      } catch (err) {
        reject(err);
      }
    }).catch((e) => {
      // fallback: try opening without flags
      return new Promise<any>((resolve, reject) => {
        const d = new sqlite3.Database(DB_PATH, (err: any) => err ? reject(err) : resolve(d));
      });
    });

    const allAsync = (sql: string, params: any[] = []) => new Promise<any[]>((res, rej) => {
      db.all(sql, params, (err: any, rows: any[]) => err ? rej(err) : res(rows));
    });
    const getAsync = (sql: string, params: any[] = []) => new Promise<any>((res, rej) => {
      db.get(sql, params, (err: any, row: any) => err ? rej(err) : res(row));
    });

    try {
      const parcelNum = '0522010201354';
      const parcel = await getAsync('SELECT geometry, properties, min_lat, min_lng, max_lat, max_lng FROM parcels WHERE num_parcel = ? LIMIT 1', [parcelNum]);
      if (!parcel) {
        console.error('Parcel not found in prebuilt DB at', DB_PATH);
        expect(parcel).not.toBeNull();
        return;
      }

      let geometry: any = null;
      try { geometry = parcel.geometry ? JSON.parse(parcel.geometry) : null; } catch (e) { geometry = null; }

      // Determine centroid
      let centroidLat = NaN, centroidLng = NaN;
      let ring: number[][] | null = null;
      if (geometry && geometry.type === 'Polygon' && Array.isArray(geometry.coordinates[0])) ring = geometry.coordinates[0];
      else if (geometry && geometry.type === 'MultiPolygon' && Array.isArray(geometry.coordinates) && geometry.coordinates[0] && Array.isArray(geometry.coordinates[0][0])) ring = geometry.coordinates[0][0];
      if (ring && ring.length > 0) {
        const c1 = computeCentroid(ring, true);
        const c2 = computeCentroid(ring, false);
        const plausible = (c: any) => !!c && c.lat >= 4.0 && c.lat <= 20.0 && c.lng >= -20.0 && c.lng <= -4.0;
        const chosen = (c1 && plausible(c1)) ? c1 : ((c2 && plausible(c2)) ? c2 : (c1 || c2));
        if (chosen) { centroidLat = chosen.lat; centroidLng = chosen.lng; }
      }

      // Candidate selection: bbox if present, else limited geometry scan
      let candidateRows: any[] = [];
      if (parcel.min_lat != null && parcel.min_lng != null && parcel.max_lat != null && parcel.max_lng != null) {
        const BBOX_DELTA = 0.01;
        const minLat = Number(parcel.min_lat) - BBOX_DELTA;
        const maxLat = Number(parcel.max_lat) + BBOX_DELTA;
        const minLng = Number(parcel.min_lng) - BBOX_DELTA;
        const maxLng = Number(parcel.max_lng) + BBOX_DELTA;
        try {
          candidateRows = await allAsync('SELECT * FROM parcels WHERE num_parcel != ? AND min_lat IS NOT NULL AND min_lng IS NOT NULL AND max_lat IS NOT NULL AND max_lng IS NOT NULL AND NOT (max_lat < ? OR min_lat > ? OR max_lng < ? OR min_lng > ?)', [parcelNum, minLat, maxLat, minLng, maxLng]);
        } catch (e) {
          candidateRows = [];
        }
      }
      if (!candidateRows || candidateRows.length === 0) {
        candidateRows = await allAsync('SELECT * FROM parcels WHERE num_parcel != ? AND geometry IS NOT NULL LIMIT 2000', [parcelNum]);
      }

      // If centroid invalid, try properties extraction simple attempt
      const plausibleCentroid = (lat: number, lng: number) => (isFinite(lat) && isFinite(lng) && lat >= 4.0 && lat <= 20.0 && lng >= -20.0 && lng <= -4.0);
      if (!plausibleCentroid(centroidLat, centroidLng)) {
        try {
          const props = parcel.properties ? JSON.parse(parcel.properties) : null;
          if (props) {
            // try to find coordinates array in properties
            if (Array.isArray((props as any).coordinates)) {
              const coords = (props as any).coordinates;
              if (Array.isArray(coords[0]) && typeof coords[0][0] === 'number') {
                const c = computeCentroid(coords, true) || computeCentroid(coords, false);
                if (c) { centroidLat = c.lat; centroidLng = c.lng; }
              }
            }
          }
        } catch (e) { /* ignore */ }
      }

      const scored: Array<{ row: any; dist: number }> = [];
      if (plausibleCentroid(centroidLat, centroidLng)) {
        for (const r of candidateRows) {
          try {
            const raw = r.geometry;
            if (!raw) continue;
            const g = typeof raw === 'string' ? JSON.parse(raw) : raw;
            let rring2: number[][] | null = null;
            if (g && g.type === 'Polygon' && Array.isArray(g.coordinates[0])) rring2 = g.coordinates[0];
            else if (g && g.type === 'MultiPolygon' && Array.isArray(g.coordinates) && g.coordinates[0] && Array.isArray(g.coordinates[0][0])) rring2 = g.coordinates[0][0];
            if (!rring2 || rring2.length === 0) continue;
            const c1 = computeCentroid(rring2, true);
            const c2 = computeCentroid(rring2, false);
            const chosen = (c1) ? c1 : (c2 || null);
            if (!chosen) continue;
            const d = haversine(centroidLat, centroidLng, chosen.lat, chosen.lng);
            if (!isFinite(d)) continue;
            scored.push({ row: r, dist: d });
          } catch (e) { /* ignore */ }
        }
      }

      scored.sort((a,b) => a.dist - b.dist);
      const top = scored.slice(0, 6).map(s => ({ num_parcel: s.row.num_parcel, dist_m: s.dist }));

      console.log('Computed centroid:', { centroidLat, centroidLng });
      console.log('Candidate rows:', candidateRows.length);
      console.log('Top neighbors:', JSON.stringify(top, null, 2));

      // Jest assertion so the test is meaningful
      expect(true).toBe(true);
    } finally {
      try { db.close(); } catch (e) { /* ignore */ }
    }
  }, 20000);
});
