import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateAddressDto } from '../dto/create-address.dto';
import { UpdateAddressDto } from '../dto/update-address.dto';
import { DatabaseService } from '../../database/providers/database.service';
import { AddressMapper } from '../mappers/address.mapper';
import { ResponseAddressDto } from '../dto/response-address.dto';
import { Prisma } from '../../../prisma/src/generated/prisma/client';
import { GetAddressQueryDto } from '../dto/get-address-query.dto';
import { PaginatedResponseDto } from '../../common/dto/response-paginated.dto';

@Injectable()
export class AddressService {
  constructor(private readonly dbService: DatabaseService) {}

  public async createAddress(
    createAddressDto: CreateAddressDto,
    currUserId: string,
  ): Promise<ResponseAddressDto> {
    const address = await this.dbService.address.create({
      data: {
        ...AddressMapper.toCreateInput(createAddressDto),
        users: { connect: { id: currUserId } },
      },
    });
    return AddressMapper.toResponseDto(address);
  }

  public async getAddresses(query: GetAddressQueryDto) {
    const hasPagination = query.page !== undefined || query.limit !== undefined;

    return hasPagination
      ? this.getAllAddresses()
      : this.getAllAddressesPaginated(query);
  }

  private async getAllAddresses(): Promise<
    PaginatedResponseDto<ResponseAddressDto>
  > {
    const addresses = await this.dbService.address.findMany();
    return {
      data: addresses.map(AddressMapper.toResponseDto),
      metadata: null,
    };
  }

  private async getAllAddressesPaginated(
    query: GetAddressQueryDto,
  ): Promise<PaginatedResponseDto<ResponseAddressDto>> {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;
    const [addresses, total] = await Promise.all([
      this.dbService.address.findMany({
        skip,
        take: limit,
        orderBy: { country: 'desc' },
      }),
      this.dbService.address.count(),
    ]);
    return {
      data: addresses.map(AddressMapper.toResponseDto),
      metadata: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  public async getAddressById(id: string): Promise<ResponseAddressDto> {
    try {
      const address = await this.dbService.address.findFirstOrThrow({
        where: { address_id: id },
      });

      return AddressMapper.toResponseDto(address);
    } catch (error: any) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(' Address Id not found!');
      }
      throw new InternalServerErrorException(
        `An Unknown Server error happened error: ${error.code}`,
      );
    }
  }

  public async updateAddressForUser(
    userId: string,
    updateAddressDto: UpdateAddressDto,
  ): Promise<ResponseAddressDto> {
    return this.dbService.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { address_id: true },
      });

      //As method can be used by an admin the check is needed
      if (!user)
        throw new NotFoundException(`User with id ${userId} not found`);

      const oldAddressId = user.address_id;

      const newAddress = await tx.address.create({
        data: AddressMapper.toCreateInput(updateAddressDto as CreateAddressDto),
      });

      await tx.user.update({
        where: { id: userId },
        data: { address_id: newAddress.address_id },
      });

      //Check if old address became orphaned
      if (oldAddressId) {
        const remainingUsers = await tx.user.count({
          where: { address_id: oldAddressId },
        });
        const remainingOrders = await tx.order.count({
          where: { address_id: oldAddressId },
        });

        if (remainingUsers === 0 && remainingOrders === 0) {
          await tx.address.delete({ where: { address_id: oldAddressId } });
        }
      }
      return AddressMapper.toResponseDto(newAddress);
    });

    // const address = await this.dbService.address.update({
    //   where: { address_id: id },
    //   data: AddressMapper.toUpdateInput(updateAddressDto),
    // });
    // return AddressMapper.toResponseDto(address);
  }

  public async removeUserFromAddressAndCleanUp(userId: string): Promise<void> {
    await this.dbService.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { address_id: true },
      });

      if (!user?.address_id) return; //nothing to detach

      const addressId = user.address_id;

      //1. Detach the user from the address
      await tx.user.update({
        where: { id: userId },
        data: { address_id: null },
      });

      //2. Check whether anyone else still ref this address

      const remaningUsers = await tx.user.count({
        where: { address_id: addressId },
      });

      const remainingOrders = await tx.order.count({
        where: { address_id: addressId },
      });

      //3. Only delete the address if nothing else points to it
      if (remaningUsers === 0 && remainingOrders === 0) {
        await tx.address.delete({ where: { address_id: addressId } });
      }
    });
  }

  public async forceDeleteAddress(addressId: string): Promise<void> {
    await this.dbService.address.delete({ where: { address_id: addressId } });
    return;
  }
}
