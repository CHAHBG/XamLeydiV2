import sqlite3, sys, os, json
root = os.path.dirname(os.path.dirname(__file__))
db = os.path.join(root, 'prebuilt', 'parcelapp.db')
if len(sys.argv) < 2:
    print('Usage: find_by_prefix.py <prefix>')
    sys.exit(1)
pref = sys.argv[1]
con = sqlite3.connect(db)
cur = con.cursor()
cur.execute("SELECT num_parcel FROM parcels WHERE num_parcel LIKE ? LIMIT 200", (pref + '%',))
rows = cur.fetchall()
if not rows:
    print('no matches')
else:
    for r in rows:
        print(r[0])
con.close()
