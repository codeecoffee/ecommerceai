import { Injectable } from "@nestjs/common";
import { CreateUserDto } from "../dto/create-user-param.dto";
import { Prisma } from '../../../prisma/src/generated/prisma/client';
import { UpdateUserDto } from "../dto/update-user.dto";

@Injectable()
export class UsersMapper{
    mapCommonFields(
    dto: CreateUserDto,
  ): Required<
    Pick<
      Prisma.UserUncheckedCreateInput,
      'first_name' | 'last_name' | 'email' | 'photo_url' | 'address_id' >
  >;

    mapCommonFields(
    dto: UpdateUserDto,
  ): Partial<
    Pick<
      Prisma.UserUncheckedUpdateInput,
      'first_name' | 'last_name' | 'email' | 'photo_url' | 'address_id' >
  >;
  mapCommonFields(
    dto: CreateUserDto | UpdateUserDto,
  ):
    | Pick<
        Prisma.UserUncheckedCreateInput,
        | 'first_name'
        | 'last_name'
        | 'email'
        | 'photo_url'
        | 'address_id'
      >
    | Pick<
        Prisma.UserUncheckedUpdateInput,
        | 'first_name'
        | 'last_name'
        | 'email'
        | 'photo_url'
        | 'address_id'
      > {
    return {
      first_name: dto.firstName,
      last_name: dto.lastName,
      email: dto.email,
      photo_url: dto.photoUrl,
      address_id: dto.addressId,
    };
  }
}







