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

export class CreateUserDto {

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(20)
  firstName!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(50)
  lastName!: string;
 
  @IsUrl()
  @IsOptional()
  photoUrl?: string;

  @IsEmail()
  @IsNotEmpty()
  email!: string;
  
  @IsUUID()
  @IsOptional()
  addressId?: string;

  @IsEnum(Role)
  @IsOptional()
  role?: Role

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/, {
    message:
      'Please enter a password with at least 8 characters, one letter, one number and one special character',
  })
  password!: string;
}
