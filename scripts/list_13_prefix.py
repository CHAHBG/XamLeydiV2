import sqlite3
from pathlib import Path
root=Path(__file__).resolve().parents[1]
db=root/'prebuilt'/'parcelapp.db'
con=sqlite3.connect(str(db))
cur=con.cursor()
cur.execute("SELECT count(*) FROM parcels WHERE num_parcel LIKE '13%'")
count=cur.fetchone()[0]
print('count13=',count)
cur.execute("SELECT id,num_parcel,village,substr(properties,1,200) FROM parcels WHERE num_parcel LIKE '13%' ORDER BY id LIMIT 50")
rows=cur.fetchall()
for r in rows:
    print(r[0], r[1], r[2])
con.close()
