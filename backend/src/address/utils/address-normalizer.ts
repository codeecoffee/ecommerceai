export class AddressNormalizer {
  static normalizeText(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[.,]+$/, '');
  }
  static normalizePostalCode(value: string): string {
    return value.replace(/\D/g, '');
  }

  static buildKey(fields: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    countryCode: string;
    latitude?: number;
    longitude?: number;
  }): string {
    if (fields.latitude !== undefined && fields.longitude !== undefined) {
      const lat = fields.latitude.toFixed(5);
      const lng = fields.longitude.toFixed(5);
      return `geo|${lat}|${lng}`;
    }
    return [
      this.normalizeText(fields.street),
      this.normalizeText(fields.city),
      this.normalizeText(fields.state),
      this.normalizePostalCode(fields.postalCode),
      fields.countryCode.toUpperCase(),
    ].join('|');
  }
}
