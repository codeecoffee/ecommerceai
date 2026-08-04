import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreatePostDto {
  @ApiProperty({ description: ' Rating 1 through 5.', example: '5' })
  @IsInt()
  @IsNotEmpty()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiProperty({
    description: 'Title of the post',
    example: 'Best fridge ever',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(30)
  title!: string;

  @ApiProperty({
    description: 'Comments on the product',
    example: ' lorem ipsum ipsum lorem',
  })
  @IsString()
  @IsOptional()
  @MinLength(5)
  @MaxLength(250)
  comment?: string;
}
