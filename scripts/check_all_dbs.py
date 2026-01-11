from pathlib import Path
import sqlite3

root = Path(__file__).parent.parent
locations = [
    root / 'prebuilt' / 'parcelapp.db',
    root / 'parcelapp.db', 
    root / 'ParcelApp' / 'parcelapp.db',
    root / 'android' / 'app' / 'src' / 'main' / 'assets' / 'parcelapp.db',
    root / 'android-bundle' / 'assets' / 'raw' / 'prebuilt_parcelapp.db'
]

for loc in locations:
    if loc.exists():
        con = sqlite3.connect(str(loc))
        cur = con.cursor()
        cur.execute('SELECT count(*) FROM parcels')
        count = cur.fetchone()[0]
        cur.execute('SELECT num_parcel FROM parcels LIMIT 3')
        first3 = [r[0] for r in cur.fetchall()]
        con.close()
        print(f'{loc.relative_to(root)}: {count} parcels, first={first3[0] if first3 else None}')
    else:
        print(f'{loc.relative_to(root)}: NOT FOUND')
