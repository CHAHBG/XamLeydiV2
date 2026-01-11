import sqlite3
import sys
from pathlib import Path


def get_tables(conn):
    cur = conn.cursor()
    cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
    return [r[0] for r in cur.fetchall()]


def get_columns(conn, table):
    cur = conn.cursor()
    cur.execute(f"PRAGMA table_info({table})")
    return [r[1] for r in cur.fetchall()]


def find_parcel(conn, parcel_num):
    tables = get_tables(conn)
    hits = []
    for t in tables:
        cols = get_columns(conn, t)
        candidates = [c for c in cols if c.lower() in ("num_parcel", "num_parcelle", "parcel_num", "parcel_number")] 
        for col in candidates:
            cur = conn.cursor()
            try:
                cur.execute(f"SELECT COUNT(*) FROM {t} WHERE {col}=?", (parcel_num,))
                count = cur.fetchone()[0]
                if count:
                    hits.append((t, col, count))
            except sqlite3.Error:
                pass
    return hits


def main():
    if len(sys.argv) < 3:
        print("Usage: python scripts/find_parcel_in_db.py <path/to/db> <parcel_num> [parcel_num ...]")
        sys.exit(1)
    db_path = Path(sys.argv[1])
    if not db_path.exists():
        print(f"DB not found: {db_path}")
        sys.exit(2)
    conn = sqlite3.connect(str(db_path))
    try:
        for pn in sys.argv[2:]:
            hits = find_parcel(conn, pn)
            if hits:
                print(f"Parcel {pn} found:")
                for (t, col, cnt) in hits:
                    print(f"  - table {t} column {col}: {cnt} rows")
            else:
                print(f"Parcel {pn} not found in any table")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
