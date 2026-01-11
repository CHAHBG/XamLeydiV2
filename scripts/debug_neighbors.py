import sqlite3
import json
import math

DB_PATH = 'prebuilt/parcelapp.db'
TARGET = '0522010201354'

def try_parse_geom(raw):
    if not raw:
        return None
    if isinstance(raw, (dict, list)):
        return raw
    try:
        return json.loads(raw)
    except Exception:
        return None


def centroid_from_ring(ring, assume_lonlat=True):
    s_lat = s_lng = 0.0
    c = 0
    for p in ring:
        if not isinstance(p, (list, tuple)) or len(p) < 2:
            continue
        a = float(p[0]); b = float(p[1])
        if assume_lonlat:
            lng = a; lat = b
        else:
            lat = a; lng = b
        s_lat += lat; s_lng += lng; c += 1
    if c == 0:
        return None
    return (s_lat/c, s_lng/c)


def plausible(lat, lng):
    return 4.0 <= lat <= 20.0 and -20.0 <= lng <= -4.0


def haversine(lat1, lon1, lat2, lon2):
    R = 6371000.0
    phi1 = math.radians(lat1); phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1); dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))


conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

cur.execute('SELECT id, num_parcel, geometry, properties FROM parcels WHERE num_parcel = ?', (TARGET,))
row = cur.fetchone()
if not row:
    print('Target parcel not found')
    raise SystemExit(1)

pid, num, geom_raw, props_raw = row
print('Found parcel', num)
geom = try_parse_geom(geom_raw)
props = try_parse_geom(props_raw)
print('properties keys:', list((props or {}).keys())[:20])

# attempt to get ring
ring = None
if geom and geom.get('type') == 'Polygon' and isinstance(geom.get('coordinates'), list):
    ring = geom['coordinates'][0]
elif geom and geom.get('type') == 'MultiPolygon' and isinstance(geom.get('coordinates'), list):
    ring = geom['coordinates'][0][0]

if not ring:
    print('No ring found in geometry; aborting')
    raise SystemExit(1)

cent = centroid_from_ring(ring, assume_lonlat=True)
cent_swapped = centroid_from_ring(ring, assume_lonlat=False)
print('cent default (lon,lat)-> (lat,lng):', cent)
print('cent swapped (lat,lon)-> (lat,lng):', cent_swapped)

if cent and plausible(*cent):
    centroid = cent
    swapped = False
elif cent_swapped and plausible(*cent_swapped):
    centroid = cent_swapped
    swapped = True
else:
    centroid = cent or cent_swapped
    swapped = None

print('Chosen centroid:', centroid, 'swapped?', swapped)

# fetch candidates
MAX = 500
cur.execute(f'SELECT id,num_parcel,geometry,properties FROM parcels WHERE num_parcel != ? AND geometry IS NOT NULL LIMIT {MAX}', (TARGET,))
rows = cur.fetchall()
print('candidates count:', len(rows))
scored = []
for r in rows:
    rid, rnum, rgeom_raw, rprops_raw = r
    rgeom = try_parse_geom(rgeom_raw)
    if not rgeom:
        continue
    rr = None
    if rgeom.get('type') == 'Polygon' and isinstance(rgeom.get('coordinates'), list):
        rr = rgeom['coordinates'][0]
    elif rgeom.get('type') == 'MultiPolygon' and isinstance(rgeom.get('coordinates'), list):
        rr = rgeom['coordinates'][0][0]
    if not rr:
        continue
    c1 = centroid_from_ring(rr, assume_lonlat=True)
    c2 = centroid_from_ring(rr, assume_lonlat=False)
    chosen = None; swapped_cand = None
    if c1 and plausible(*c1):
        chosen = c1; swapped_cand = False
    elif c2 and plausible(*c2):
        chosen = c2; swapped_cand = True
    else:
        chosen = c1 or c2
    if not chosen:
        continue
    d = haversine(centroid[0], centroid[1], chosen[0], chosen[1])
    scored.append((d, rnum, chosen, swapped_cand))

scored.sort()
print('Top 20 candidates:')
for s in scored[:20]:
    d, rnum, chosen, swapped_cand = s
    print(f'{rnum} dist_m={int(d)} centroid={chosen} swapped={swapped_cand}')

conn.close()
