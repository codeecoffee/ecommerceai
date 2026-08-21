import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsUrl, IsUUID, Min } from 'class-validator';

export class CreateProductDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  sku: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  description: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUrl()
  photoUrl?: string;

  @ApiProperty()
  @IsNumber({maxDecimalPlaces: 2})
  @Min(0)
  price: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  stockQty: number;

  @ApiProperty()
  @IsUUID()
  categoryId: number;

}
