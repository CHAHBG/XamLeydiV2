import sqlite3
import json
import sys
from math import radians, cos, sin, asin, sqrt

DB = 'prebuilt/parcelapp.db'

# haversine distance
def haversine(lat1, lon1, lat2, lon2):
    # convert decimal degrees to radians
    lon1, lat1, lon2, lat2 = map(radians, [lon1, lat1, lon2, lat2])
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * asin(sqrt(a))
    km = 6367 * c
    return km


def extract_centroid(properties):
    c = properties.get('Centroide') or properties.get('Centroide')
    if c and isinstance(c, str):
        parts = c.split()
        if len(parts) >= 2:
            try:
                lat = float(parts[0])
                lon = float(parts[1])
                return lat, lon
            except Exception:
                return None
    # fallback to _Centroide_latitude/_longitude
    lat = properties.get('_Centroide_latitude')
    lon = properties.get('_Centroide_longitude')
    if lat and lon:
        try:
            return float(lat), float(lon)
        except Exception:
            return None
    return None


def geometry_is_2d(geom):
    # geom is a dict from the DB; check coordinates for any 3-element tuples or obviously swapped values
    if not geom:
        return False, 'empty geom'
    coords = geom.get('coordinates')
    if not coords:
        return False, 'no coords'

    # find first numeric coordinate pair anywhere in nested lists
    def find_numeric(arr):
        if isinstance(arr, list):
            for x in arr:
                if isinstance(x, list) and len(x) >= 2 and all(isinstance(y, (int, float)) for y in x[:2]):
                    return x
                elif isinstance(x, list):
                    res = find_numeric(x)
                    if res:
                        return res
        return None

    try:
        num = find_numeric(coords)
        if not num:
            return False, 'no numeric pair found'
        # num is like [lon, lat] or [lon, lat, alt]
        if len(num) >= 3:
            return False, '3d coordinate present'
        lon, lat = num[0], num[1]
        # sanity check lat/lon ranges
        if abs(lat) > 90 or abs(lon) > 180:
            return False, f'out of range lat/lon: {lat},{lon}'
        # check common swapped condition (lon in [-90,90] and lat in [-180,180] but lon > 90 improbable)
        if abs(lon) <= 90 and abs(lat) <= 180 and abs(lon) > 90 and abs(lat) <= 90:
            return False, 'possible swapped lat/lon'
        return True, 'ok'
    except Exception as e:
        return False, f'error: {e}'


def main(num_parcel):
    con = sqlite3.connect(DB)
    cur = con.cursor()
    cur.execute('SELECT id, num_parcel, geometry, properties FROM parcels WHERE num_parcel = ?', (num_parcel,))
    row = cur.fetchone()
    if not row:
        print('parcel not found')
        return
    pid, n, geom_json, props_json = row
    geom = json.loads(geom_json)
    props = json.loads(props_json)
    centroid = extract_centroid(props)
    print('centroid:', centroid)
    ok, reason = geometry_is_2d(geom)
    print('parcel geometry ok?', ok, reason)

    # find neighbors within 2km of centroid
    if not centroid:
        print('no centroid to find neighbors')
        return
    lat, lon = centroid
    cur.execute('SELECT id, num_parcel, geometry, properties FROM parcels')
    bad_neighbors = []
    count = 0
    for r in cur.fetchall():
        rid, rnum, rgeom_json, rprops_json = r
        rgeom = json.loads(rgeom_json)
        rprops = json.loads(rprops_json)
        ok2, reason2 = geometry_is_2d(rgeom)
        # compute neighbor centroid
        rc = extract_centroid(rprops)
        if not rc:
            continue
        rlat, rlon = rc
        d = haversine(lat, lon, rlat, rlon)
        if d <= 2.0:  # within 2 km
            count += 1
            if not ok2:
                bad_neighbors.append((rnum, reason2, rc))
    print(f'found {count} neighbors within 2km, {len(bad_neighbors)} bad')
    for bn in bad_neighbors[:50]:
        print(bn)
    con.close()

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('Usage: check_neighbors.py <num_parcel>')
    else:
        main(sys.argv[1])
