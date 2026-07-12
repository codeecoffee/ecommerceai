import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(20)
  firstName: string;
  @IsString()
  @IsOptional()
  @MinLength(3)
  @MaxLength(50)
  lastName?: string;
  @IsEmail()
  @IsNotEmpty()
  email: string;
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/, {
    message:
      'Please enter a password with at least 8 characters, one letter, one number and one special character',
  })
  password: string;
}
