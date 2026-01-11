import json, sqlite3
from pathlib import Path

root=Path(__file__).resolve().parents[1]
parcel='0522010205945'

print('Root:', root)

# Check src JSON
src_path = root / 'src' / 'data' / 'Parcels_individuels.json'
prebuilt_json_path = root / 'prebuilt' / 'Parcels_individuels.json'

for name,p in [('src', src_path), ('prebuilt_json', prebuilt_json_path)]:
    if p.exists():
        st=p.stat()
        print(f"{name} JSON: {p} size={st.st_size} mtime={st.st_mtime}")
        try:
            with open(p,'r',encoding='utf-8') as f:
                data=json.load(f)
            if isinstance(data,dict) and 'features' in data:
                features = data['features']
            elif isinstance(data,list):
                features = data
            else:
                features = []
            found=None
            for fobj in features:
                props = fobj.get('properties',{})
                if props.get('Num_parcel')==parcel or props.get('Num_parcel_2')==parcel:
                    found=props
                    break
            if found:
                print(f"  Found: Num_parcel={found.get('Num_parcel')} Village={found.get('Village')} layer={found.get('layer')}")
            else:
                print('  NOT FOUND')
        except Exception as e:
            print('  error reading json:', e)
    else:
        print(f"{name} JSON missing: {p}")

# Check DBs
prebuilt_db = root / 'prebuilt' / 'parcelapp.db'
assets_db = root / 'android' / 'app' / 'src' / 'main' / 'assets' / 'parcelapp.db'

for name,dbp in [('prebuilt_db', prebuilt_db), ('assets_db', assets_db)]:
    if dbp.exists():
        st=dbp.stat()
        print(f"{name}: {dbp} size={st.st_size} mtime={st.st_mtime}")
        try:
            con=sqlite3.connect(str(dbp))
            cur=con.cursor()
            cur.execute('SELECT id,num_parcel,village,substr(properties,1,400) FROM parcels WHERE num_parcel=?', (parcel,))
            rows=cur.fetchall()
            print('  rows=', len(rows))
            for r in rows:
                print(' ',r[0],r[1],r[2])
                print('  properties snippet:', r[3][:300].replace('\n',' '))
            con.close()
        except Exception as e:
            print('  db error', e)
    else:
        print(f"{name} missing: {dbp}")
