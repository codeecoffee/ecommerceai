import { Injectable } from '@nestjs/common';
import {
  AddressGeocoder,
  GeocodedAddress,
} from '../interfaces/address-geocoder.interface';
import { PhotonResponse } from '../interfaces/photon-response.interface';
import * as countries from 'i18n-iso-countries';
import * as en from 'i18n-iso-countries/langs/en.json';

countries.registerLocale(en);

@Injectable()
export class PhotonGeocoderService implements AddressGeocoder {
  private readonly baseUrl: string = 'https://photon.komot.io/api';

  async geocode(rawAddress: string): Promise<GeocodedAddress | null> {
    const params = new URLSearchParams({
      q: rawAddress,
      lang: 'en',
      limit: '1',
    });

    const response = await fetch(`${this.baseUrl}?${params}`);
    if (!response.ok) {
      throw new Error(`Photon request failed: ${response.status}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const data: PhotonResponse = await response.json();
    const feature = data.features?.[0];
    if (!feature) return null; //falls back to raw input

    const props = feature.properties;
    const [longitude, latitude] = feature.geometry?.coordinates ?? [
      undefined,
      undefined,
    ];

    const countryCode =
      this.resolveCountryCode(props.countrycode, props.countrycode) ?? null;
    if (!countryCode) return null; // treat as unresolved

    return {
      street: [props.street, props.housenumber].filter(Boolean).join(', '),
      city: props.city ?? props.town ?? props.village ?? '',
      state: props.state ?? '',
      postalCode: props.postcode ?? '',
      countryCode,
      latitude,
      longitude,
    };
  }

  private resolveCountryCode(
    rawCode: string | undefined,
    countryName: string | undefined,
  ): string | null {
    if (rawCode) return rawCode.toUpperCase();
    if (!countryName) return null;
    const resolved = countries.getAlpha2Code(countryName, 'en');
    return resolved ?? null;
  }
}
