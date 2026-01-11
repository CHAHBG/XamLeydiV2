#!/usr/bin/env python3
import sqlite3
import json
import sys

DB_PATH = 'prebuilt/parcelapp.db'
VILLAGES = ['Netteboulou', 'Sinthiou Maleme', 'Sinthiou_Maleme', 'Sinthiou', 'Netteboulou']

def inspect_village(conn, name):
    cur = conn.cursor()
    # Search both village column and properties JSON text (case-insensitive)
    pattern = f"%{name}%"
    rows = cur.execute("SELECT id, num_parcel, village, geometry, properties, min_lat, min_lng, max_lat, max_lng FROM parcels WHERE (village LIKE ? OR properties LIKE ?) COLLATE NOCASE", (pattern, pattern)).fetchall()
    return rows


def summarize_rows(rows, limit=5):
    out = {}
    out['count'] = len(rows)
    out['sample'] = []
    for r in rows[:limit]:
        id_, num, village, geom, props, min_lat, min_lng, max_lat, max_lng = r
        has_geom = 1 if geom and geom.strip() else 0
        has_props = 1 if props and props.strip() else 0
        bbox_populated = 1 if (min_lat is not None and min_lng is not None and max_lat is not None and max_lng is not None) else 0
        # try parse properties to capture commune/region keys
        parsed_props = None
        try:
            parsed_props = json.loads(props) if props and props.strip() else None
        except Exception:
            parsed_props = None
        sample = {
            'id': id_,
            'num_parcel': num,
            'village': village,
            'has_geometry': bool(has_geom),
            'has_properties': bool(has_props),
            'bbox_populated': bool(bbox_populated),
            'min_lat': min_lat,
            'min_lng': min_lng,
            'max_lat': max_lat,
            'max_lng': max_lng,
            'properties_keys': list(parsed_props.keys())[:10] if isinstance(parsed_props, dict) else None
        }
        out['sample'].append(sample)
    return out


def main():
    try:
        conn = sqlite3.connect(DB_PATH)
    except Exception as e:
        print('ERROR: could not open DB at', DB_PATH, e)
        sys.exit(1)

    results = {}
    total_found = 0
    for v in VILLAGES:
        rows = inspect_village(conn, v)
        summary = summarize_rows(rows)
        results[v] = summary
        total_found += summary['count']

    # print JSON summary
    print(json.dumps({'db_path': DB_PATH, 'total_matches': total_found, 'villages': results}, indent=2, ensure_ascii=False))

if __name__ == '__main__':
    main()
