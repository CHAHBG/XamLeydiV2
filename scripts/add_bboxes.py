import sqlite3, json, math

DB='prebuilt/parcelapp.db'

def parse_geom(raw):
    if not raw: return None
    if isinstance(raw, (dict, list)): return raw
    try: return json.loads(raw)
    except: return None

def extract_points(geom):
    if not geom: return []
    t = geom.get('type')
    c = geom.get('coordinates')
    pts = []
    try:
        if t == 'Polygon' and isinstance(c, list) and len(c)>0:
            for p in c[0]:
                if isinstance(p, (list,tuple)) and len(p)>=2:
                    pts.append((float(p[0]), float(p[1])))
        elif t == 'MultiPolygon' and isinstance(c, list) and len(c)>0:
            for poly in c:
                if isinstance(poly, list) and len(poly)>0 and isinstance(poly[0], list):
                    for p in poly[0]:
                        if isinstance(p, (list,tuple)) and len(p)>=2:
                            pts.append((float(p[0]), float(p[1])))
    except Exception as e:
        return []
    return pts


def compute_bbox(pts):
    # pts are pairs (a,b) where order ambiguous (lon,lat) or (lat,lon)
    if not pts: return None
    # try assume lon,lat
    lats = [p[1] for p in pts]
    lngs = [p[0] for p in pts]
    minLat = min(lats); maxLat = max(lats); minLng = min(lngs); maxLng = max(lngs)
    if 4.0 <= minLat <= 20.0 and 4.0 <= maxLat <= 20.0 and -20.0 <= minLng <= -4.0 and -20.0 <= maxLng <= -4.0:
        return (minLat, minLng, maxLat, maxLng)
    # try swapped (lat,lon)
    lats2 = [p[0] for p in pts]
    lngs2 = [p[1] for p in pts]
    minLat2=min(lats2); maxLat2=max(lats2); minLng2=min(lngs2); maxLng2=max(lngs2)
    if 4.0 <= minLat2 <= 20.0 and 4.0 <= maxLat2 <= 20.0 and -20.0 <= minLng2 <= -4.0 and -20.0 <= maxLng2 <= -4.0:
        return (minLat2, minLng2, maxLat2, maxLng2)
    # fallback to first assumption
    return (minLat, minLng, maxLat, maxLng)

conn = sqlite3.connect(DB)
cur = conn.cursor()
# add columns if missing
try:
    cur.execute('ALTER TABLE parcels ADD COLUMN min_lat REAL')
    cur.execute('ALTER TABLE parcels ADD COLUMN min_lng REAL')
    cur.execute('ALTER TABLE parcels ADD COLUMN max_lat REAL')
    cur.execute('ALTER TABLE parcels ADD COLUMN max_lng REAL')
    conn.commit()
    print('Added bbox columns')
except Exception as e:
    print('Columns may already exist or alter failed:', e)

cur.execute('SELECT id, num_parcel, geometry FROM parcels')
rows = cur.fetchall()
print('Rows to process:', len(rows))
count=0
for r in rows:
    pid, num, raw = r
    geom = parse_geom(raw)
    pts = extract_points(geom)
    bbox = compute_bbox(pts)
    if not bbox:
        continue
    minLat,minLng,maxLat,maxLng = bbox
    try:
        cur.execute('UPDATE parcels SET min_lat=?, min_lng=?, max_lat=?, max_lng=? WHERE id=?', (minLat,minLng,maxLat,maxLng,pid))
        count+=1
    except Exception as e:
        print('update failed for', pid, e)

conn.commit()
print('Updated', count, 'rows with bbox')
conn.close()
