import sqlite3
from pathlib import Path

def query_db(path_str, parcel_num):
    p = Path(path_str)
    if not p.exists():
        print(f"DB not found: {p}")
        return
    con = sqlite3.connect(str(p))
    cur = con.cursor()
    try:
        cur.execute("PRAGMA table_info(parcels)")
        schema = cur.fetchall()
        print(f"\nDB: {p} -- schema columns: {[c[1] for c in schema]}")
        cur.execute("SELECT id, num_parcel, parcel_type, village, properties FROM parcels WHERE num_parcel = ?", (parcel_num,))
        rows = cur.fetchall()
        print(f"Found {len(rows)} rows for {parcel_num} in {p}")
        for r in rows[:5]:
            print(r)
    except Exception as e:
        print("Query error:", e)
    finally:
        con.close()

if __name__ == '__main__':
    parcel = '0522010205945'
    root = Path(__file__).resolve().parents[1]
    prebuilt = root / 'prebuilt' / 'parcelapp.db'
    android_assets = root / 'android' / 'app' / 'src' / 'main' / 'assets' / 'parcelapp.db'
    query_db(prebuilt, parcel)
    query_db(android_assets, parcel)
