import { IsEnum } from 'class-validator';
import { Role } from '../../../prisma/src/generated/prisma/client';

export class UpdateUserRoleDto {
  @IsEnum(Role)
  role!: Role;
}
