import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Role } from '../../../prisma/src/generated/prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ description: "User's first name", example: 'Joao' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(20)
  firstName!: string;

  @ApiProperty({ description: "User's last name", example: 'Da Silva' })
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  lastName!: string;

  @ApiProperty({
    description: "User's photo url",
    example:
      'https:\/\/images.unsplash.com\/photo-1503944583220-79d8926ad5e2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w0OTE2MTF8MHwxfHNlYXJjaHwyM3x8VGVlbmFnZXJ8ZW58MHwyfHx8MTY5NzM2MzkxN3ww&ixlib=rb-4.0.3&q=80&w=400',
  })
  @IsUrl()
  @IsOptional()
  photoUrl?: string;

  @ApiProperty({ description: "User's email", example: 'useremail@email.com' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({
    description: 'Address UUID',
    example: '7aa02917-e3b5-4e83-9849-352f0c8dff2e',
  })
  @IsUUID()
  @IsOptional()
  addressId?: string;

  @IsEnum(Role)
  @IsOptional()
  role?: Role;

  @ApiProperty({
    description:
      'Password with at least 8 characters, one letter, one number and at least one special character',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/, {
    message:
      'Please enter a password with at least 8 characters, one letter, one number and one special character',
  })
  password!: string;
}
