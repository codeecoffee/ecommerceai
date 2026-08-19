import { ApiProperty } from '@nestjs/swagger';
import {
  IsISO31661Alpha2,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateAddressDto {
  @ApiProperty({ description: 'Full street address' })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(50)
  street!: string;

  @ApiProperty({ description: 'City' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(25)
  city!: string;

  @ApiProperty({ description: 'State' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(20)
  state!: string;

  @ApiProperty({ description: 'Postal Code' })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(10)
  postalCode!: string;

  @ApiProperty({ description: 'Country' })
  @IsISO31661Alpha2()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(3)
  countryCode!: string;
}
