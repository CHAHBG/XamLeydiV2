import sqlite3
import json
import math

DB_PATH = 'prebuilt/parcelapp.db'
TARGET = '0522010201354'
EXPAND_DEG = 0.02  # ~2km at these latitudes


def parse_geom(raw):
    if not raw:
        return None
    try:
        if isinstance(raw, (dict, list)):
            return raw
        return json.loads(raw)
    except Exception:
        return None


def extract_coords(geom):
    if not geom: return []
    t = geom.get('type')
    coords = geom.get('coordinates')
    pts = []
    if t == 'Polygon' and isinstance(coords, list):
        for p in coords[0]:
            if isinstance(p, (list, tuple)) and len(p) >= 2:
                pts.append((float(p[0]), float(p[1])))
    elif t == 'MultiPolygon' and isinstance(coords, list):
        for poly in coords:
            for p in poly[0]:
                if isinstance(p, (list, tuple)) and len(p) >= 2:
                    pts.append((float(p[0]), float(p[1])))
    return pts


def bbox_of_points(pts, assume_lonlat=True):
    if not pts: return None
    lats = []
    lngs = []
    for a,b in pts:
        if assume_lonlat:
            lngs.append(a); lats.append(b)
        else:
            lats.append(a); lngs.append(b)
    return (min(lats), min(lngs), max(lats), max(lngs))  # (minLat, minLng, maxLat, maxLng)


def bbox_intersect(a, b):
    if not a or not b: return False
    aminLat, aminLng, amaxLat, amaxLng = a
    bminLat, bminLng, bmaxLat, bmaxLng = b
    return not (amaxLat < bminLat or bmaxLat < aminLat or amaxLng < bminLng or bmaxLng < aminLng)


conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()
cur.execute('SELECT num_parcel, geometry, properties FROM parcels WHERE num_parcel = ?', (TARGET,))
row = cur.fetchone()
if not row:
    print('target not found'); raise SystemExit(1)
num, geom_raw, props_raw = row
geom = parse_geom(geom_raw)
pts = extract_coords(geom)
print('target pts sample:', pts[:5])

# compute bbox try both orders
bbox1 = bbox_of_points(pts, assume_lonlat=True)
bbox2 = bbox_of_points(pts, assume_lonlat=False)
print('bbox1 (lon,lat assumed) -> (minLat,minLng,maxLat,maxLng):', bbox1)
print('bbox2 (lat,lon assumed) ->', bbox2)

# choose plausible bbox
def plausible_bbox(b):
    if not b: return False
    minLat, minLng, maxLat, maxLng = b
    return (4.0 <= minLat <= 20.0 and 4.0 <= maxLat <= 20.0 and -20.0 <= minLng <= -4.0 and -20.0 <= maxLng <= -4.0)

if plausible_bbox(bbox1):
    bbox = bbox1; swapped=False
elif plausible_bbox(bbox2):
    bbox = bbox2; swapped=True
else:
    bbox = bbox1 or bbox2; swapped=None

print('chosen bbox, swapped?:', bbox, swapped)
minLat, minLng, maxLat, maxLng = bbox
minLat -= EXPAND_DEG; minLng -= EXPAND_DEG; maxLat += EXPAND_DEG; maxLng += EXPAND_DEG
print('expanded bbox:', (minLat, minLng, maxLat, maxLng))

# scan all parcels and find those whose bbox intersects expanded bbox
cur.execute('SELECT num_parcel, geometry, properties FROM parcels WHERE num_parcel != ?', (TARGET,))
matches = []
for r in cur.fetchall():
    rnum, rgeom_raw, rprops = r
    rgeom = parse_geom(rgeom_raw)
    pts_r = extract_coords(rgeom)
    if not pts_r: continue
    bbox_r1 = bbox_of_points(pts_r, assume_lonlat=True)
    bbox_r2 = bbox_of_points(pts_r, assume_lonlat=False)
    chosen_r = None
    if plausible_bbox(bbox_r1) and bbox_intersect((minLat,minLng,maxLat,maxLng), bbox_r1):
        chosen_r = (bbox_r1, False)
    elif plausible_bbox(bbox_r2) and bbox_intersect((minLat,minLng,maxLat,maxLng), bbox_r2):
        chosen_r = (bbox_r2, True)
    else:
        # if none plausible, still test intersection with either bbox
        if bbox_r1 and bbox_intersect((minLat,minLng,maxLat,maxLng), bbox_r1): chosen_r = (bbox_r1, False)
        elif bbox_r2 and bbox_intersect((minLat,minLng,maxLat,maxLng), bbox_r2): chosen_r = (bbox_r2, True)
    if chosen_r:
        matches.append((rnum, chosen_r[1]))

print('bbox-intersect matches count:', len(matches))
for m in matches[:50]:
    print(m)

conn.close()
