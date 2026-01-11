// Geometry normalization helpers
function safeParseJSON(raw: any) {
  if (!raw || typeof raw !== 'string') return raw || null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

function extractPairs(coords: any): number[][] {
  if (!Array.isArray(coords)) return [];
  if (coords.length === 0) return [];
  if (typeof coords[0] === 'number') {
    return [coords.slice(0, 3).map((v: any) => Number(v))];
  }
  const out: number[][] = [];
  for (const c of coords) {
    out.push(...extractPairs(c));
  }
  return out;
}

function decideOrder(pairs: number[][]): 'lonlat' | 'latlon' {
  let lonlat = 0, latlon = 0;
  for (let i = 0; i < Math.min(200, pairs.length); i++) {
    const p = pairs[i];
    if (!p || p.length < 2) continue;
    const a = Math.abs(p[0]), b = Math.abs(p[1]);
    // If first seems in lon-range and second in lat-range -> lon,lat
    if (a <= 180 && b <= 90) lonlat++;
    if (a <= 90 && b <= 180) latlon++;
  }
  // If latlon votes are strictly greater, assume lat,lon ordering
  return latlon > lonlat ? 'latlon' : 'lonlat';
}

function mapPairs(coords: any, swap: boolean): any {
  if (!Array.isArray(coords)) return coords;
  if (coords.length === 0) return coords;
  if (typeof coords[0] === 'number') {
    const a = Number(coords[0]);
    const b = Number(coords[1]);
    if (!isFinite(a) || !isFinite(b)) return null;
    const lon = swap ? b : a;
    const lat = swap ? a : b;
    return [Number(lon), Number(lat)];
  }
  const out: any[] = [];
  for (const c of coords) {
    const mapped = mapPairs(c, swap);
    if (mapped != null) out.push(mapped);
  }
  return out;
}

export function normalizeGeometry(raw: any): any | null {
  if (!raw) return null;
  const g = typeof raw === 'string' ? safeParseJSON(raw) : raw;
  if (!g || typeof g !== 'object') return null;

  // If GeoJSON Feature wrapper
  let geom = g;
  if (geom.type === 'Feature' && geom.geometry) geom = geom.geometry;
  if (!geom.type || !geom.coordinates) return null;

  // Work on deep clone
  let clone: any = JSON.parse(JSON.stringify(geom));

  const pairs = extractPairs(clone.coordinates);
  if (pairs.length === 0) return null;
  const order = decideOrder(pairs);
  const swap = order === 'latlon';

  try {
    // Debug: show a small sample of pairs and the chosen order to help diagnose ordering edge-cases
    if (console && (console.debug || console.log)) {
      const sample = pairs.slice(0, 6).map((p) => p.slice(0, 2));
      (console.debug || console.log)(`normalizeGeometry: decideOrder samplePairs=${JSON.stringify(sample)} order=${order} swap=${swap}`);
    }
  } catch (e) {
    // ignore logging errors
  }

  clone.coordinates = mapPairs(clone.coordinates, swap);
  return clone;
}

export default { normalizeGeometry };
