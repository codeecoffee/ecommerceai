import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
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
  @MinLength(3)
  @MaxLength(25)
  city!: string;

  @ApiProperty({ description: 'State' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(20)
  state!: string;

  @ApiProperty({ description: 'Postal Code' })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(10)
  postalCode!: string;

  @ApiProperty({ description: 'Country' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(20)
  country!: string;

  @ApiProperty({ description: 'Users who have this address' })
  @IsString()
  @IsNotEmpty()
  users!: string[];
}
