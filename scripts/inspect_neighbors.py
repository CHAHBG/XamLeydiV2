import sqlite3
import json
import math
from pathlib import Path

DB_PATH = Path(__file__).resolve().parents[1] / 'prebuilt' / 'parcelapp.db'

VILLAGES = ['Netteboulou', 'Sinthiou Maleme', 'Netteboulou '.upper(), 'SINTHIOU', 'Sinthiou']

def safe_parse(geom_raw):
    if geom_raw is None:
        return None
    if isinstance(geom_raw, str):
        try:
            return json.loads(geom_raw)
        except:
            return None
    return geom_raw

# compute centroid for polygon coords list of [lon, lat] pairs
def centroid_from_coords(coords):
    if not coords:
        return None
    # coords may be [{latitude, longitude}] or [[lon, lat]]
    if isinstance(coords[0], dict):
        lat_sum = 0.0; lon_sum = 0.0; n=0
        for p in coords:
            try:
                lat = float(p.get('latitude', p.get('lat', 0)))
                lon = float(p.get('longitude', p.get('lon', 0)))
                lat_sum += lat; lon_sum += lon; n+=1
            except: pass
        return (lat_sum/n, lon_sum/n) if n>0 else None
    else:
        lat_sum = 0.0; lon_sum = 0.0; n=0
        for p in coords:
            try:
                lon = float(p[0]); lat = float(p[1])
                lat_sum += lat; lon_sum += lon; n+=1
            except: pass
        return (lat_sum/n, lon_sum/n) if n>0 else None

# haversine distance in meters
def haversine(a, b):
    lat1, lon1 = math.radians(a[0]), math.radians(a[1])
    lat2, lon2 = math.radians(b[0]), math.radians(b[1])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    R = 6371000
    h = math.sin(dlat/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin(dlon/2)**2
    return 2*R*math.asin(math.sqrt(h))

conn = sqlite3.connect(str(DB_PATH))
cur = conn.cursor()

print('DB path:', DB_PATH)

# fetch candidate parcels matching villages
for village in ['Netteboulou','Sinthiou Maleme']:
    print('\n=== Searching for village match:', village)
    q = "SELECT id, num_parcel, village, geometry, properties FROM parcels WHERE upper(village) LIKE ? LIMIT 50"
    like = f"%{village.upper()}%"
    cur.execute(q, (like,))
    rows = cur.fetchall()
    if not rows:
        print('No direct village matches. Trying substring search on properties...')
        q2 = "SELECT id, num_parcel, village, geometry, properties FROM parcels WHERE upper(properties) LIKE ? LIMIT 50"
        cur.execute(q2, (like,))
        rows = cur.fetchall()
    print('Found', len(rows), 'rows')
    for r in rows[:5]:
        pid, num, vill, geom, props = r
        print('id=',pid,'num=',num,'village=',vill)
        g = safe_parse(geom)
        if g and isinstance(g, dict):
            if g.get('type') == 'Polygon' and isinstance(g.get('coordinates'), list):
                coords = g['coordinates'][0] if len(g['coordinates'])>0 else None
            elif g.get('type') == 'MultiPolygon' and isinstance(g.get('coordinates'), list):
                coords = g['coordinates'][0][0] if len(g['coordinates'])>0 and len(g['coordinates'][0])>0 else None
            else:
                coords = None
            c = centroid_from_coords(coords) if coords else None
            print(' centroid=', c)
        else:
            print(' geometry missing or unparsable')

    # If we have at least one parcel, compute distances to all parcels and show nearest
    if rows:
        base = rows[0]
        g = safe_parse(base[3])
        if g and isinstance(g, dict):
            if g.get('type') == 'Polygon' and isinstance(g.get('coordinates'), list):
                coords = g['coordinates'][0] if len(g['coordinates'])>0 else None
            elif g.get('type') == 'MultiPolygon' and isinstance(g.get('coordinates'), list):
                coords = g['coordinates'][0][0] if len(g['coordinates'])>0 and len(g['coordinates'][0])>0 else None
            else:
                coords = None
            center = centroid_from_coords(coords) if coords else None
            if not center:
                print('Could not compute centroid for base parcel')
                continue
            print('Using base centroid:', center)
            # compute distances to all parcels with geometry
            cur.execute("SELECT id, num_parcel, village, geometry FROM parcels")
            allp = cur.fetchall()
            dists = []
            for ap in allp:
                aid, anum, avill, ageom = ap
                g2 = safe_parse(ageom)
                if not g2 or not isinstance(g2, dict):
                    continue
                if g2.get('type') == 'Polygon' and isinstance(g2.get('coordinates'), list):
                    coords2 = g2['coordinates'][0] if len(g2['coordinates'])>0 else None
                elif g2.get('type') == 'MultiPolygon' and isinstance(g2.get('coordinates'), list):
                    coords2 = g2['coordinates'][0][0] if len(g2['coordinates'])>0 and len(g2['coordinates'][0])>0 else None
                else:
                    coords2 = None
                c2 = centroid_from_coords(coords2) if coords2 else None
                if not c2: continue
                dist = haversine(center, c2)
                dists.append((dist, aid, anum, avill, c2))
            dists.sort(key=lambda x: x[0])
            print('\nNearest parcels to base (top 20):')
            for dd in dists[:20]:
                print(f"{dd[1]} | num={dd[2]} | village={dd[3]} | dist_m={dd[0]:.1f} | centroid={dd[4]}")

conn.close()
print('\nDone')
