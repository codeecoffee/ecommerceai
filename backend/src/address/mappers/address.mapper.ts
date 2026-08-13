import { Address, Prisma } from '../../../prisma/src/generated/prisma/client';
import { ResponseAddressDto } from '../dto/response-address.dto';
import { AddressNormalizer } from '../utils/address-normalizer';

export class AddressMapper {
  static toCreateInput(dto: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    countryCode: string;
    latitude?: number;
    longitude?: number;
  }): Prisma.AddressCreateInput {
    return {
      street: dto.street,
      city: dto.city,
      state: dto.state,
      postal_code: dto.postalCode,
      country: dto.countryCode,
      normalized_key: AddressNormalizer.buildKey(dto),
    };
  }

  // static toUpdateInput(dto: UpdateAddressDto): Prisma.AddressUpdateInput {
  //   return {
  //     ...(dto.street !== undefined && { street: dto.street }),
  //     ...(dto.city !== undefined && { city: dto.city }),
  //     ...(dto.state !== undefined && { state: dto.state }),
  //     ...(dto.postalCode !== undefined && { postal_code: dto.postalCode }),
  //     ...(dto.country !== undefined && { country: dto.country }),
  //   };
  // }

  static toResponseDto(address: Address): ResponseAddressDto {
    return {
      addressId: address.address_id,
      street: address.street,
      city: address.city,
      state: address.state,
      postalCode: address.postal_code,
      countryCode: address.country,
    };
  }
}
