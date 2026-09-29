import { IsEnum } from 'class-validator';
import { Role } from '../../generated/prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserRoleDto {
  @ApiProperty({ enum: Role, example: 'ADMIN' })
  @IsEnum(Role)
  role!: Role;
}
