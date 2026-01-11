#!/usr/bin/env python3
import json

# Check JSON files structure
ind_json = json.load(open('C:/Users/ASUS/Documents/Application/ParcelApp/src/data/Parcels_individuels.json', encoding='utf-8'))
col_json = json.load(open('C:/Users/ASUS/Documents/Application/ParcelApp/src/data/Parcels_collectives.json', encoding='utf-8'))

print('='*60)
print('Checking first individual parcel properties:')
print('='*60)
if ind_json['features']:
    props = ind_json['features'][0]['properties']
    print(f'\nAll property keys ({len(props)} total):')
    for key in sorted(props.keys()):
        value = props[key]
        if isinstance(value, str) and len(value) > 50:
            value = value[:50] + '...'
        print(f'  {key}: {value}')

print('\n' + '='*60)
print('Checking first collective parcel properties:')
print('='*60)
if col_json['features']:
    props = col_json['features'][0]['properties']
    print(f'\nAll property keys ({len(props)} total):')
    for key in sorted(props.keys()):
        value = props[key]
        if isinstance(value, str) and len(value) > 50:
            value = value[:50] + '...'
        print(f'  {key}: {value}')

# Search for the specific parcel using various possible field names
print('\n' + '='*60)
print('Searching for 0522020200234 using different field names:')
print('='*60)

search_fields = ['Num_Parcel', 'num_parcel', 'NUM_PARCEL', 'Numero', 'numero', 'Id', 'id', 'parcel_id', 'PARCEL_ID']

for field in search_fields:
    found_ind = [f for f in ind_json['features'] if str(f.get('properties', {}).get(field, '')) == '0522020200234']
    found_col = [f for f in col_json['features'] if str(f.get('properties', {}).get(field, '')) == '0522020200234']
    
    if found_ind or found_col:
        print(f'\nFound using field "{field}":')
        if found_ind:
            print(f'  In individuels: YES')
        if found_col:
            print(f'  In collectives: YES')
