import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateAddressDto } from '../dto/create-address.dto';
import { UpdateAddressDto } from '../dto/update-address.dto';
import { DatabaseService } from '../../database/providers/database.service';
import { AddressMapper } from '../mappers/address.mapper';
import { ResponseAddressDto } from '../dto/response-address.dto';
import { Prisma } from '../../../prisma/src/generated/prisma/client';
import { GetAddressQueryDto } from '../dto/get-address-query.dto';
import { ADDRESS_GEOCODER } from '../interfaces/address-geocoder.token';
import type {
  AddressGeocoder,
  GeocodedAddress,
} from '../interfaces/address-geocoder.interface';
import { AddressNormalizer } from '../utils/address-normalizer';

@Injectable()
export class AddressService {
  constructor(
    private readonly dbService: DatabaseService,
    @Inject(ADDRESS_GEOCODER) private readonly geocoder: AddressGeocoder,
  ) {}

  private async resolveCanonicalFields(dto: CreateAddressDto) {
    const rawQuery = `${dto.street}, ${dto.city}, ${dto.state}, ${dto.postalCode}`;
    let geocoded: GeocodedAddress | null = null;
    try {
      geocoded = await this.geocoder.geocode(rawQuery);
    } catch {
      geocoded = null;
    }
    return (
      geocoded ?? {
        street: dto.street,
        city: dto.city,
        state: dto.state,
        postalCode: dto.postalCode,
        countryCode: dto.countryCode,
      }
    );
  }

  //tx: Prisma.TransactionClient
  private async findOrCreateAddress(
    tx: Prisma.TransactionClient,
    dto: CreateAddressDto,
  ) {
    const resolved = await this.resolveCanonicalFields(dto);
    const normalizedKey = AddressNormalizer.buildKey(resolved);

    const existing = await tx.address.findUnique({
      where: { normalized_key: normalizedKey },
    });
    if (existing) {
      return existing;
    }
    try {
      return await tx.address.create({
        data: AddressMapper.toCreateInput(resolved),
      });
    } catch (err: any) {
      if (err.code === 'P2002') {
        return await tx.address.findUniqueOrThrow({
          where: { normalized_key: normalizedKey },
        });
      }
      throw err;
    }
  }

  private async cleanupIfOrphaned(
    tx: Prisma.TransactionClient,
    addressId: string,
  ) {
    const [userCount, orderCount] = await Promise.all([
      tx.user.count({ where: { address_id: addressId } }),
      tx.order.count({ where: { address_id: addressId } }),
    ]);
    if (userCount === 0 && orderCount === 0) {
      await tx.address.delete({ where: { address_id: addressId } });
    }
  }

  public async addAddressForUser(
    userId: string,
    dto: CreateAddressDto,
  ): Promise<ResponseAddressDto> {
    return this.dbService.$transaction(async (tx: Prisma.TransactionClient) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { address_id: true },
      });
      if (!user) throw new NotFoundException(`User ${userId} not found`);
      if (user.address_id) {
        throw new ConflictException(
          'User already has an address - use update instead',
        );
      }

      const address = await this.findOrCreateAddress(tx, dto);
      await tx.user.update({
        where: { id: userId },
        data: { address_id: address.address_id },
      });
      return AddressMapper.toResponseDto(address);
    });
  }

  public async updateAddressForUser(
    userId: string,
    dto: UpdateAddressDto,
  ): Promise<ResponseAddressDto> {
    return this.dbService.$transaction(async (tx: Prisma.TransactionClient) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { address_id: true },
      });
      if (!user) throw new NotFoundException(`User ${userId} not found`);
      if (!user.address_id)
        throw new NotFoundException('User has no address to update');

      const current = await tx.address.findUniqueOrThrow({
        where: { address_id: user.address_id },
      });

      const merged: CreateAddressDto = {
        street: dto.street ?? current.street,
        city: dto.city ?? current.city,
        state: dto.state ?? current.state,
        postalCode: dto.postalCode ?? current.postal_code,
        countryCode: dto.countryCode ?? current.country,
      };

      const newAddress = await this.findOrCreateAddress(tx, merged);

      if (newAddress.address_id === current.address_id)
        return AddressMapper.toResponseDto(newAddress);
      await tx.user.update({
        where: { id: userId },
        data: { address_id: newAddress.address_id },
      });
      await this.cleanupIfOrphaned(tx, current.address_id);

      return AddressMapper.toResponseDto(newAddress);
    });
  }

  public async deleteAddressForUser(userId: string): Promise<void> {
    return this.dbService.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { address_id: true },
      });
      if (!user?.address_id)
        throw new NotFoundException(`User ${userId} has no address to delete`);
      const addressId = user.address_id;
      await tx.user.update({
        where: { id: userId },
        data: { address_id: null },
      });
      await this.cleanupIfOrphaned(tx, addressId);
    });
  }

  public async getAddresses(query: GetAddressQueryDto) {
    const { page = 1, limit = 10 } = query;
    const [addresses, total] = await Promise.all([
      this.dbService.address.findMany({
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.dbService.address.count(),
    ]);
    return {
      data: addresses.map((addr) => AddressMapper.toResponseDto(addr)),
      total,
      page,
      limit,
    };
  }

  public async getAddressById(addressId: string): Promise<ResponseAddressDto> {
    const address = await this.dbService.address.findUnique({
      where: { address_id: addressId },
    });
    if (!address) throw new NotFoundException(`Address ${addressId} not found`);
    return AddressMapper.toResponseDto(address);
  }
}
