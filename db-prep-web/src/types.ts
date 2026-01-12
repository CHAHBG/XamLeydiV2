export type GeoJSONGeometry = {
  type: string;
  coordinates: any;
};

export type GeoJSONFeature = {
  type: 'Feature';
  geometry?: GeoJSONGeometry | null;
  properties?: Record<string, any> | null;
  [k: string]: any;
};

export type FeatureCollection = {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
};
