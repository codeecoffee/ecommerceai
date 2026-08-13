import { ApiProperty } from '@nestjs/swagger';

export class ResponseAddressDto {
  @ApiProperty({ description: 'Address Id' })
  addressId!: string;

  @ApiProperty({ description: 'Street' })
  street!: string;

  @ApiProperty({ description: 'City' })
  city!: string;

  @ApiProperty({ description: 'State' })
  state!: string;

  @ApiProperty({ description: 'Postal Code' })
  postalCode!: string;

  @ApiProperty({ description: 'Country' })
  countryCode!: string;
}
