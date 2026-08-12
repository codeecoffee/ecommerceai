import { CreateUserDto } from '../dto/create-user.dto';
import { Prisma, User } from '../../../prisma/src/generated/prisma/client';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UserResponseDto } from '../dto/response-user.dto';

export class UsersMapper {
  static toCreateInput(
    dto: CreateUserDto,
  ): Omit<Prisma.UserUncheckedCreateInput, 'password_hash'> {
    return {
      first_name: dto.firstName,
      last_name: dto.lastName,
      email: dto.email,
      photo_url: dto.photoUrl,
      address_id: dto.addressId,
      role: dto.role,
    };
  }

  static toUpdateInput(dto: UpdateUserDto): Prisma.UserUncheckedUpdateInput {
    return {
      ...(dto.firstName !== undefined && { first_name: dto.firstName }),
      ...(dto.lastName !== undefined && { last_name: dto.lastName }),
      ...(dto.email !== undefined && { email: dto.email }),
      ...(dto.photoUrl !== undefined && { photo_url: dto.photoUrl }),
      ...(dto.addressId !== undefined && { address_id: dto.addressId }),
    };
  }

  static toResponseDto(user: User): UserResponseDto {
    return {
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      photoUrl: user.photo_url,
      addressId: user.address_id,
      role: user.role,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };
  }
}
