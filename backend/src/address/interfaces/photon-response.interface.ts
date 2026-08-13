export interface PhotonProperties {
  street?: string;
  housenumber?: string;
  city?: string;
  town?: string;
  village?: string;
  state?: string;
  postcode?: string;
  country?: string;
  countrycode?: string;
}

export interface PhotonGeometry {
  type: 'Point';
  coordinates: [number, number];
}

export interface PhotonFeature {
  type: 'Feature';
  properties: PhotonProperties;
  geometry: PhotonGeometry;
}

export interface PhotonResponse {
  type: 'FeatureCollection';
  features: PhotonFeature[];
}
