import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

export class UserResponseDto {
  @ApiProperty({ description: 'User UUID' })
  @Expose()
  id!: string;

  @ApiProperty({ description: 'Users first name' })
  @Expose()
  firstName!: string;

  @ApiProperty({ description: 'Users last name' })
  @Expose()
  lastName!: string;

  @ApiProperty({ description: 'Users email' })
  @Expose()
  email!: string;

  @ApiProperty({ description: 'Users photo Url' })
  @Expose()
  photoUrl!: string | null;

  @ApiProperty({ description: 'Users address UUID' })
  @Expose()
  addressId!: string | null;

  @ApiProperty({ description: 'User Role', example: 'USER | ADMIN' })
  @Expose()
  role!: string;

  @ApiProperty({ description: 'User creation date' })
  @Expose()
  createdAt!: Date;

  @ApiProperty({ description: 'Users last updated date' })
  @Expose()
  updatedAt!: Date;
}
