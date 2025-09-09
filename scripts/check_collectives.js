const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, '..', 'src', 'data', 'Parcels_collectives.json');
const raw = fs.readFileSync(filePath, 'utf8');
const data = JSON.parse(raw);
const want = '1312010210102';
let found = [];
if (Array.isArray(data)) {
  data.forEach((item, idx) => {
    const props = item && item.properties ? item.properties : item;
    if (!props) return;
    const keys = ['Num_parcel','Num_parcel_2','Num_parcelle','Num_parc','num_parcel','id','fid'];
    for(const k of keys){
      if (props[k] && String(props[k]).includes(want)) {
        found.push({idx, key:k, props});
        break;
      }
    }
  });
} else if (data && Array.isArray(data.features)) {
  data.features.forEach((f, idx) => {
    const props = f && f.properties ? f.properties : f;
    if (!props) return;
    const keys = ['Num_parcel','Num_parcel_2','Num_parcelle','Num_parc','num_parcel','id','fid'];
    for(const k of keys){
      if (props[k] && String(props[k]).includes(want)) {
        found.push({idx, key:k, props});
        break;
      }
    }
  });
}
console.log('Found', found.length, 'matches');
if(found.length){
  console.log(Object.keys(found[0].props).slice(0,30));
  console.log('Sample fields:');
  console.log('Prenom_001_COL:', found[0].props['Prenom_001_COL']);
  console.log('Nom_001_COL:', found[0].props['Nom_001_COL']);
  console.log('Telephone:', found[0].props['Telephone']||found[0].props['Telephone_COL']||found[0].props['telephone']);
}
