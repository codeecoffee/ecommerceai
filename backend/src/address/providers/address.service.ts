import { Injectable } from '@nestjs/common';
import { CreateAddressDto } from '../dto/create-address.dto';
import { UpdateAddressDto } from '../dto/update-address.dto';
import { DatabaseService } from '../../database/providers/database.service';
import { AddressMapper } from '../mappers/address.mapper';
import { ResponseAddressDto } from '../dto/response-address.dto';

@Injectable()
export class AddressService {
  constructor(
    private readonly dbService : DatabaseService
  ){}

  //TODO!: Add user id who created the address - An address must have at least 1 user
  public async create(createAddressDto: CreateAddressDto): Promise<ResponseAddressDto> {
    const address = await this.dbService.address.create({
      data: AddressMapper.toCreateInput(createAddressDto),
    })
    return AddressMapper.toResponseDto(address)
  }

  findAll() {
    return `This action returns all address`;
  }

  findOne(id: string) {
    return `This action returns a #${id} address`;
  }

  public async update(id: string, updateAddressDto: UpdateAddressDto): Promise<ResponseAddressDto> {
    const address = await this.dbService.address.update({
      where: { address_id: id },
      data: AddressMapper.toUpdateInput(updateAddressDto)
    })
    return AddressMapper.toResponseDto(address)
  }

  remove(id: string) {
    return `This action removes a #${id} address`;
  }
}
