/* Small normalization script: updates GeoJSON geometries to remove altitude values (3rd element), rounds coords to 7 decimals, ensures features have `type: 'Feature'` and `geometry.type` correctness. Creates backups before writing.

Usage: node scripts/normalize_geo.js
*/
const fs = require('fs');
const path = require('path');

function normalizeCoordsArray(coords) {
  if (!Array.isArray(coords)) return coords;
  // Handle nested arrays recursively
  return coords.map(c => {
    if (Array.isArray(c) && typeof c[0] === 'number') {
      // single coordinate: [lon, lat, alt?]
      const lon = Number(c[0]);
      const lat = Number(c[1]);
      if (Number.isNaN(lon) || Number.isNaN(lat)) return c;
      return [Number(lon.toFixed(7)), Number(lat.toFixed(7))];
    }
    return normalizeCoordsArray(c);
  });
}

function normalizeFeature(feature) {
  if (!feature || typeof feature !== 'object') return feature;
  if (feature.type !== 'Feature') feature.type = 'Feature';
  if (feature.geometry) {
    const geom = feature.geometry;
    if (geom.coordinates) {
      geom.coordinates = normalizeCoordsArray(geom.coordinates);
    }
    // normalize geometry type strings
    if (geom.type) {
      geom.type = String(geom.type);
    }
  }
  return feature;
}

function processFile(rel) {
  const file = path.join(__dirname, '..', rel);
  const backup = file + '.bak';
  console.log('Processing', file);
  if (!fs.existsSync(file)) {
    console.error('File not found:', file);
    return;
  }
  fs.copyFileSync(file, backup);
  const raw = fs.readFileSync(file, 'utf8');
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.error('JSON parse failed for', file, e.message);
    return;
  }
  if (!Array.isArray(data)) {
    console.error('Expected a Feature[] array in', file);
    return;
  }
  let changed = 0;
  for (let i = 0; i < data.length; i++) {
    const f = data[i];
    const before = JSON.stringify(f.geometry);
    const nf = normalizeFeature(f);
    const after = JSON.stringify(nf.geometry);
    if (before !== after) changed++;
    data[i] = nf;
  }
  fs.writeFileSync(file, JSON.stringify(data, null, 4), 'utf8');
  console.log(`Wrote ${file}, changed ${changed} features (backup at ${backup})`);
}

processFile('src/data/Parcels_collectives.json');
processFile('src/data/Parcels_individuels.json');
