import sqlite3
from pathlib import Path
import os

root = Path(__file__).resolve().parents[1]
assets_db = root / 'android' / 'app' / 'src' / 'main' / 'assets' / 'parcelapp.db'

print(f'Checking: {assets_db}')

if assets_db.exists():
    stat = assets_db.stat()
    print(f'Size: {stat.st_size} bytes ({stat.st_size / 1024 / 1024:.2f} MB)')
    print(f'Last modified: {stat.st_mtime}')
    
    con = sqlite3.connect(str(assets_db))
    cur = con.cursor()
    cur.execute('SELECT count(*) FROM parcels')
    count = cur.fetchone()[0]
    print(f'\nTotal parcels: {count}')
    
    cur.execute('SELECT num_parcel FROM parcels ORDER BY id LIMIT 10')
    parcels = cur.fetchall()
    print('\nFirst 10 parcel numbers:')
    for (num,) in parcels:
        print(f'  {num}')
    
    con.close()
else:
    print('ERROR: File does not exist!')
