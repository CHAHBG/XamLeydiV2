import zipfile
import sqlite3
import tempfile
import os
from pathlib import Path

apk_path = r'C:\Users\ASUS\Documents\Application\ParcelApp\android\app\build\outputs\apk\release\app-release.apk'
print(f'Checking APK: {apk_path}')

with zipfile.ZipFile(apk_path, 'r') as z:
    # List assets
    assets = [f for f in z.namelist() if 'parcelapp.db' in f.lower()]
    print(f'\nDatabase files in APK:')
    for asset in assets:
        info = z.getinfo(asset)
        print(f'  {asset}: {info.file_size} bytes (compressed: {info.compress_size})')
    
    # Extract and check the main DB
    db_asset = 'assets/parcelapp.db'
    if db_asset in z.namelist():
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = z.extract(db_asset, tmpdir)
            print(f'\nExtracted to: {db_path}')
            
            # Query the database
            con = sqlite3.connect(db_path)
            cur = con.cursor()
            cur.execute('SELECT count(*) FROM parcels')
            count = cur.fetchone()[0]
            print(f'Total parcels in APK DB: {count}')
            
            cur.execute('SELECT num_parcel FROM parcels ORDER BY id LIMIT 10')
            parcels = cur.fetchall()
            print('\nFirst 10 parcel numbers:')
            for (num,) in parcels:
                print(f'  {num}')
            
            con.close()
    else:
        print(f'\nERROR: {db_asset} not found in APK!')
