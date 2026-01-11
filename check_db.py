#!/usr/bin/env python3
import sqlite3
import json

# Check database
db_path = 'C:/Users/ASUS/Documents/Application/ParcelApp/prebuilt/parcelapp.db'
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Get counts
cursor.execute("SELECT COUNT(*) FROM parcels WHERE parcel_type = 'individuel'")
ind = cursor.fetchone()[0]

cursor.execute("SELECT COUNT(*) FROM parcels WHERE parcel_type = 'collectif'")
col = cursor.fetchone()[0]

cursor.execute("SELECT COUNT(*) FROM parcels")
total = cursor.fetchone()[0]

print(f'Database Stats:')
print(f'  Total: {total}')
print(f'  Individual: {ind}')
print(f'  Collective: {col}')

# Search for specific parcel
cursor.execute("SELECT num_parcel, parcel_type FROM parcels WHERE num_parcel LIKE '%0522020200234%' LIMIT 5")
results = cursor.fetchall()
print(f'\nSearching for parcel 0522020200234 in database:')
if results:
    for r in results:
        print(f'  {r[0]} - {r[1]}')
else:
    print('  Not found in database')

conn.close()

# Check JSON files
print('\n' + '='*60)
print('Checking source JSON files:')
print('='*60)

ind_json = json.load(open('C:/Users/ASUS/Documents/Application/ParcelApp/src/data/Parcels_individuels.json', encoding='utf-8'))
col_json = json.load(open('C:/Users/ASUS/Documents/Application/ParcelApp/src/data/Parcels_collectives.json', encoding='utf-8'))

print(f'\nParcels_individuels.json: {len(ind_json["features"])} features')
print(f'Parcels_collectives.json: {len(col_json["features"])} features')

# Search in JSON
print(f'\nSearching for 0522020200234 in JSON files:')
found_ind = [f for f in ind_json['features'] if '0522020200234' in str(f.get('properties', {}).get('Num_Parcel', ''))]
found_col = [f for f in col_json['features'] if '0522020200234' in str(f.get('properties', {}).get('Num_Parcel', ''))]

if found_ind:
    print(f'  Found in individuels: {found_ind[0]["properties"].get("Num_Parcel", "N/A")}')
    print(f'  Properties keys: {list(found_ind[0]["properties"].keys())[:10]}...')
    
if found_col:
    print(f'  Found in collectives: {found_col[0]["properties"].get("Num_Parcel", "N/A")}')
    print(f'  Properties keys: {list(found_col[0]["properties"].keys())[:10]}...')
    
if not found_ind and not found_col:
    print('  Not found in JSON files')
    # Sample some parcel numbers
    print('\nSample parcel numbers from individuels:')
    for i, f in enumerate(ind_json['features'][:5]):
        print(f'    {f["properties"].get("Num_Parcel", "N/A")}')
    print('\nSample parcel numbers from collectives:')
    for i, f in enumerate(col_json['features'][:5]):
        print(f'    {f["properties"].get("Num_Parcel", "N/A")}')
