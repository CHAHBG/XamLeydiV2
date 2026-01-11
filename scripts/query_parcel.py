import sqlite3, json, sys, os
root = os.path.dirname(os.path.dirname(__file__))
db = os.path.join(root, 'prebuilt', 'parcelapp.db')
num = sys.argv[1] if len(sys.argv) > 1 else '0522010201354'
con = sqlite3.connect(db)
con.row_factory = sqlite3.Row
cur = con.cursor()
cur.execute('SELECT id, num_parcel, parcel_type, geometry, properties FROM parcels WHERE num_parcel = ? LIMIT 1', (num,))
row = cur.fetchone()
if not row:
    print('Not found')
else:
    out = dict(row)
    try:
        out['properties'] = json.loads(out['properties'])
    except Exception:
        pass
    try:
        out['geometry'] = json.loads(out['geometry'])
    except Exception:
        pass
    print(json.dumps(out, ensure_ascii=False, indent=2))
con.close()
