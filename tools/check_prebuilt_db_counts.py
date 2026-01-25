import sqlite3
from pathlib import Path

p = Path(__file__).resolve().parents[1] / "prebuilt" / "parcelapp.db"

con = sqlite3.connect(str(p))
cur = con.cursor()

def q(sql: str) -> int:
    return int(cur.execute(sql).fetchone()[0])

print("DB:", p)
print("parcels:", q("select count(1) from parcels"))
print("individuel:", q("select count(1) from parcels where parcel_type='individuel'"))
print("collectif:", q("select count(1) from parcels where parcel_type='collectif'"))

con.close()
