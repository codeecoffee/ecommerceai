export interface GeocodedAddress {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  countryCode: string;
  latitude?: number;
  longitude?: number;
}

export interface AddressGeocoder {
  geocode(rawAddress: string): Promise<GeocodedAddress | null>;
}
