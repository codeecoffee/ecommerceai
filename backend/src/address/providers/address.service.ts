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
import { metadata } from 'reflect-metadata/no-conflict';
import { PaginatedResponseDto } from '../../common/dto/response-paginated.dto';

@Injectable()
export class AddressService {
  constructor(private readonly dbService: DatabaseService) {}

  public async create(
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

  public async GetAddresses(query: GetAddressQueryDto) {
    const hasPagination = query.page !== undefined || query.limit !== undefined;

    return hasPagination
      ? this.GetAllAddresses()
      : this.GetAllAddressesPaginated(query);
  }

  private async GetAllAddresses(): Promise<
    PaginatedResponseDto<ResponseAddressDto>
  > {
    const addresses = await this.dbService.address.findMany();
    return {
      data: addresses.map(AddressMapper.toResponseDto),
      metadata: null,
    };
  }

  private async GetAllAddressesPaginated(
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

  public async update(
    id: string,
    updateAddressDto: UpdateAddressDto,
  ): Promise<ResponseAddressDto> {
    const address = await this.dbService.address.update({
      where: { address_id: id },
      data: AddressMapper.toUpdateInput(updateAddressDto),
    });
    return AddressMapper.toResponseDto(address);
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
}
