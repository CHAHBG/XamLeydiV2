import sqlite3
import json
import os
import time
import math
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

# Performance optimization: Better DB generation with threading and optimized SQLite settings
def canonicalize_properties(properties: dict) -> dict:
    """Return a shallow copy of properties with some common variant keys
    mapped to canonical names expected by the app UI.

    Examples handled:
      - Vocation_1 -> Vocation
      - any key like type_usa / typeusage -> type_usag
    """
    if not properties:
        return properties
    props = dict(properties)  # shallow copy

    # Canonicalize vocation-like keys
    if not props.get('Vocation'):
        for k, v in properties.items():
            if k and isinstance(k, str) and k.lower().replace('_', '').startswith('vocation') and v:
                props['Vocation'] = v
                break

    # Canonicalize type usage keys -> 'type_usag'
    if not props.get('type_usag'):
        for k, v in properties.items():
            if not k or not isinstance(k, str):
                continue
            kl = k.lower().replace('_', '').replace(' ', '')
            # common variants
            if kl in ('typeusa', 'typeusage', 'typeusag', 'typeusag1', 'typeusa1', 'usage') and v:
                props['type_usag'] = v
                break

    # Canonicalize village-like keys -> 'Village'
    if not props.get('Village'):
        for k, v in properties.items():
            if not k or not isinstance(k, str) or not v:
                continue
            kl = k.lower().strip()
            # accept keys like 'village', 'village_name', 'village_sene', 'commune', 'commune_senegal', 'locality'
            if ('village' in kl or kl.startswith('village') or 'commune' in kl or 'localit' in kl or 'locality' in kl) and v:
                # prefer shorter names without trailing codes
                props['Village'] = v
                break

    return props
def process_batch(batch, parcel_type):
    """Process a batch of parcels in a separate thread"""
    result = []
    for f in batch:
        properties = f.get('properties', {}) or {}
        # Produce a canonicalized properties dict so the DB stores app-expected keys
        properties = canonicalize_properties(properties)
        if parcel_type == 'individuel':
            result.append((
                properties.get('Num_parcel'),
                parcel_type,
                properties.get('Typ_pers'),
                properties.get('Prenom'),
                properties.get('Nom'),
                None,  # prenom_m
                None,  # nom_m
                properties.get('Denominat'),
                properties.get('Village'),
                json.dumps(f.get('geometry', {})),
                json.dumps(properties)
            ))
        else:  # collectif
            result.append((
                properties.get('Num_parcel'),
                parcel_type,
                properties.get('Typ_pers'),
                None,  # prenom
                None,  # nom
                properties.get('Prenom_M'),
                properties.get('Nom_M'),
                properties.get('Denominat'),
                properties.get('Village'),
                json.dumps(f.get('geometry', {})),
                json.dumps(properties)
            ))
    return result

def create_optimized_db():
    """Main function to create the optimized database"""
    print("Starting optimized DB generation...")
    start_time = time.time()
    
    # Define paths
    root = Path(__file__).resolve().parents[1]
    out_dir = root / 'prebuilt'
    out_dir.mkdir(parents=True, exist_ok=True)
    out = out_dir / 'parcelapp.db'
    
    # Load JSON data with progress
    print("Loading JSON data...")
    json_start = time.time()
    
    # Prefer prebuilt copies if present to avoid keeping huge JSON in src/data
    ind_path = root / 'prebuilt' / 'Parcels_individuels.json'
    col_path = root / 'prebuilt' / 'Parcels_collectives.json'
    def normalize_geojson(obj, name):
        """Accept either a list of features or a GeoJSON FeatureCollection object.
        Return a list of feature objects. Raise ValueError with a helpful message
        if input doesn't match expected shapes.
        """
        if obj is None:
            return []
        if isinstance(obj, list):
            return obj
        if isinstance(obj, dict):
            # Common GeoJSON shape: { "type": "FeatureCollection", "features": [ ... ] }
            if 'features' in obj and isinstance(obj['features'], list):
                return obj['features']
            # Sometimes users will put a single feature under 'feature'
            if 'feature' in obj and isinstance(obj['feature'], list):
                return obj['feature']
        # If we get here, the structure is unexpected. Give a clear error.
        raise ValueError(f"Unexpected JSON shape for {name}: expected a list or FeatureCollection with 'features' array")

    # Load individuals JSON
    if ind_path.exists():
        with open(ind_path, 'r', encoding='utf-8') as f:
            raw_individus = json.load(f)
    else:
        with open(root / 'src' / 'data' / 'Parcels_individuels.json', 'r', encoding='utf-8') as f:
            raw_individus = json.load(f)

    # Load collectives JSON
    if col_path.exists():
        with open(col_path, 'r', encoding='utf-8') as f:
            raw_collectifs = json.load(f)
    else:
        with open(root / 'src' / 'data' / 'Parcels_collectives.json', 'r', encoding='utf-8') as f:
            raw_collectifs = json.load(f)

    # Normalize shapes into lists of features
    try:
        individus = normalize_geojson(raw_individus, 'Parcels_individuels.json')
        collectifs = normalize_geojson(raw_collectifs, 'Parcels_collectives.json')
    except ValueError as e:
        print(f"ERROR: {e}")
        print("Aborting DB generation. Please ensure the JSON files are either arrays of features or a FeatureCollection with a 'features' array.")
        return

    print(f"JSON loading complete in {time.time() - json_start:.2f}s")
    print(f"Processing {len(individus)} individual parcels and {len(collectifs)} collective parcels ({len(individus) + len(collectifs)} total)...")

    # Remove existing database if it exists
    if out.exists():
        out.unlink()

    # Optimize SQLite for faster inserts
    con = sqlite3.connect(str(out))
    con.execute('PRAGMA synchronous = OFF')
    con.execute('PRAGMA journal_mode = MEMORY')
    con.execute('PRAGMA temp_store = MEMORY')
    con.execute('PRAGMA cache_size = 10000')
    con.execute('PRAGMA locking_mode = EXCLUSIVE')
    con.execute('PRAGMA page_size = 4096')  # Optimize page size
    
    cur = con.cursor()
    
    # Create table structure with case-insensitive search columns
    print("Creating table structure...")
    cur.execute('''CREATE TABLE parcels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        num_parcel TEXT COLLATE NOCASE,
        parcel_type TEXT,
        typ_pers TEXT,
        prenom TEXT,
        nom TEXT,
        prenom_m TEXT,
        nom_m TEXT,
        denominat TEXT,
        village TEXT COLLATE NOCASE,
        geometry TEXT,
        properties TEXT
    );''')
    
    # Define SQL statement for batch inserts
    insert_sql = '''INSERT INTO parcels 
        (num_parcel, parcel_type, typ_pers, prenom, nom, prenom_m, nom_m, denominat, village, geometry, properties) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'''
    
    # Process data in parallel batches
    print("Processing individual parcels...")
    
    # Calculate optimal batch size based on data volume
    # Use more threads for larger data sets
    total_records = len(individus) + len(collectifs)
    batch_size = min(5000, max(1000, math.ceil(total_records / 20)))
    max_workers = min(32, os.cpu_count() * 2)
    
    # Process individual parcels in batches
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        # Split data into batches for parallel processing
        batches = [individus[i:i + batch_size] for i in range(0, len(individus), batch_size)]
        futures = [executor.submit(process_batch, batch, 'individuel') for batch in batches]
        
        # Process results as they complete
        batch_count = 0
        total_batches = len(batches)
        for future in as_completed(futures):
            batch_count += 1
            rows = future.result()
            cur.executemany(insert_sql, rows)
            print(f"Processed individual batch {batch_count}/{total_batches} ({len(rows)} records)")
    
    # Process collective parcels
    print("Processing collective parcels...")
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        # Split data into batches for parallel processing
        batches = [collectifs[i:i + batch_size] for i in range(0, len(collectifs), batch_size)]
        futures = [executor.submit(process_batch, batch, 'collectif') for batch in batches]
        
        # Process results as they complete
        batch_count = 0
        total_batches = len(batches)
        for future in as_completed(futures):
            batch_count += 1
            rows = future.result()
            cur.executemany(insert_sql, rows)
            print(f"Processed collective batch {batch_count}/{total_batches} ({len(rows)} records)")
    
    # Create indices after inserting data for better performance
    print("Creating indices for faster searches...")
    cur.execute('CREATE INDEX idx_num_parcel ON parcels(num_parcel);')
    cur.execute('CREATE INDEX idx_village ON parcels(village);')
    cur.execute('CREATE INDEX idx_parcel_type ON parcels(parcel_type);')
    
    # Commit changes and close connection
    con.commit()
    con.close()
    
    # Print final statistics
    end_time = time.time()
    total_time = end_time - start_time
    print(f'Database generation complete in {total_time:.2f}s')
    print(f'Average processing speed: {total_records / total_time:.2f} records/second')
    print(f'Wrote prebuilt DB to {out}')
    
    # Copy the database to the android assets folder
    print("Copying database to Android assets...")
    android_assets = root / 'android' / 'app' / 'src' / 'main' / 'assets'
    android_assets.mkdir(exist_ok=True, parents=True)
    android_db_path = android_assets / 'parcelapp.db'
    
    # Use buffer for faster copy
    with open(out, 'rb') as src, open(android_db_path, 'wb') as dst:
        dst.write(src.read())
    
    print(f"Database copied to Android assets: {android_db_path}")
    print(f"Total optimization complete in {time.time() - start_time:.2f}s")
    
if __name__ == "__main__":
    create_optimized_db()
