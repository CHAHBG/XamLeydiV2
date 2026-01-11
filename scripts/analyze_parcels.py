import sqlite3
from pathlib import Path
from collections import Counter
root=Path(__file__).resolve().parents[1]
db=root/'prebuilt'/'parcelapp.db'
con=sqlite3.connect(str(db))
cur=con.cursor()
cur.execute("SELECT count(*) FROM parcels")
total=cur.fetchone()[0]
print(f'Total parcels: {total}')
cur.execute("SELECT num_parcel FROM parcels ORDER BY id LIMIT 20")
rows=cur.fetchall()
print('\nFirst 20 parcel numbers:')
for r in rows:
    print(' ', r[0])
# Count by first 2 digits
cur.execute("SELECT num_parcel FROM parcels")
all_parcels = cur.fetchall()
prefixes = Counter()
for (num,) in all_parcels:
    if num and len(num) >= 2:
        prefixes[num[:2]] += 1
print(f'\nParcel number prefixes (first 2 digits):')
for prefix, count in prefixes.most_common(10):
    print(f'  {prefix}*: {count} parcels')
con.close()
