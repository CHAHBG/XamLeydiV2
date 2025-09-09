const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, 'Parcels_collectives.json');

const raw = fs.readFileSync(filePath, 'utf8');
const data = JSON.parse(raw);

function findIND(obj, pathPrefix = '') {
  const found = [];
  if (obj && typeof obj === 'object') {
    for (const k of Object.keys(obj)) {
      const val = obj[k];
      const p = pathPrefix ? `${pathPrefix}.${k}` : k;
      if (/_IND$/.test(k)) {
        found.push(p);
      }
      if (val && typeof val === 'object') {
        found.push(...findIND(val, p));
      }
    }
  }
  return found;
}

let totalFound = 0;
let examples = [];

if (Array.isArray(data)) {
  data.forEach((item, idx) => {
    if (item && item.properties && typeof item.properties === 'object') {
      const f = findIND(item.properties, `features[${idx}].properties`);
      if (f.length) {
        totalFound += f.length;
        if (examples.length < 20) examples.push(...f.slice(0, 20 - examples.length));
      }
    }
  });
} else if (data && Array.isArray(data.features)) {
  data.features.forEach((item, idx) => {
    if (item && item.properties && typeof item.properties === 'object') {
      const f = findIND(item.properties, `features[${idx}].properties`);
      if (f.length) {
        totalFound += f.length;
        if (examples.length < 20) examples.push(...f.slice(0, 20 - examples.length));
      }
    }
  });
} else {
  console.error('Unexpected file structure');
  process.exit(2);
}

console.log('Total *_IND keys found in JSON properties:', totalFound);
if (examples.length) {
  console.log('Examples (up to 20):');
  examples.forEach(e => console.log('  ', e));
}
process.exit(0);
