export type LatLng = { latitude: number; longitude: number };

/**
 * Collects coordinates from a main parcel geometry and an array of neighbor features.
 * Returns a flat array of LatLng points suitable for MapView.fitToCoordinates.
 */
export function collectFitCoordinates(mainGeometry: any, neighborFeatures: any[] = []): LatLng[] {
  const coords: LatLng[] = [];
  try {
    if (mainGeometry) {
      const geom = typeof mainGeometry === 'string' ? JSON.parse(mainGeometry) : mainGeometry;
      if (geom) {
        if (geom.type === 'Polygon' && Array.isArray(geom.coordinates[0])) {
          const ring = geom.coordinates[0];
          coords.push(...ring.map((c: number[]) => ({ latitude: c[1], longitude: c[0] })));
        } else if (geom.type === 'MultiPolygon' && Array.isArray(geom.coordinates)) {
          geom.coordinates.forEach((poly: any) => {
            if (Array.isArray(poly) && poly[0]) {
              coords.push(...poly[0].map((c: number[]) => ({ latitude: c[1], longitude: c[0] })));
            }
          });
        }
      }
    }

    if (Array.isArray(neighborFeatures)) {
      neighborFeatures.forEach((n) => {
        try {
          const g = typeof n.geometry === 'string' ? JSON.parse(n.geometry) : n.geometry;
          if (!g) return;
          if (g.type === 'Polygon' && Array.isArray(g.coordinates)) {
            g.coordinates.forEach((ring: any[]) => {
              if (Array.isArray(ring)) coords.push(...ring.map((c: number[]) => ({ latitude: c[1], longitude: c[0] })));
            });
          } else if (g.type === 'MultiPolygon' && Array.isArray(g.coordinates)) {
            g.coordinates.forEach((poly: any[]) => {
              if (Array.isArray(poly)) poly.forEach((ring: any[]) => { if (Array.isArray(ring)) coords.push(...ring.map((c: number[]) => ({ latitude: c[1], longitude: c[0] }))); });
            });
          }
        } catch (e) {
          // ignore malformed neighbor geometry
        }
      });
    }
  } catch (e) {
    // ignore
  }
  return coords;
}
