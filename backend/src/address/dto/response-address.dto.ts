import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class ResponseAddressDto {
  @ApiProperty({ description: 'Address Id' })
  @Expose()
  addressId!: string;

  @ApiProperty({ description: 'Street' })
  @Expose()
  street!: string;

  @ApiProperty({ description: 'City' })
  @Expose()
  city!: string;

  @ApiProperty({ description: 'State' })
  @Expose()
  state!: string;

  @ApiProperty({ description: 'Postal Code' })
  @Expose()
  postalCode!: string;

  @ApiProperty({ description: 'Country' })
  @Expose()
  country!: string;
}
