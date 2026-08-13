import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AddressService } from './providers/address.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import {
  ApiBearerAuth,
  ApiBody,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { OwnershipOrAdminGuard } from '../auth/guards/ownership-or-admin.guard';
import { GetAddressQueryDto } from './dto/get-address-query.dto';
import { ResponseAddressDto } from './dto/response-address.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CheckOwnership } from '../auth/decorators/check-ownership.decorator';
import { GetUserAddressParamDto } from './dto/get-user-address-param.dto';

@Controller('address')
@ApiTags('Address')
export class AddressController {
  constructor(private readonly addressService: AddressService) {}

  @Post('user/:userId')
  @ApiOperation({
    summary: 'Add an address for a specific user (self or admin)',
  })
  @ApiBody({ type: CreateAddressDto })
  @ApiResponse({
    status: 201,
    description: 'Address created and linked to the user successfully',
  })
  @UseGuards(OwnershipOrAdminGuard)
  @CheckOwnership({ resource: 'user', paramName: 'userId' })
  @ApiBearerAuth('access-token')
  public async createAddress(
    @Body() createAddressDto: CreateAddressDto,
    @Param() params: GetUserAddressParamDto,
  ) {
    return this.addressService.addAddressForUser(
      params.userId,
      createAddressDto,
    );
  }

  @Get()
  @ApiOperation({
    summary: 'Fetches a list of registered addresses',
  })
  @ApiResponse({
    status: 200,
    description: 'Addresses fetched successfully based on query',
    type: ResponseAddressDto,
  })
  @ApiQuery({
    name: 'limit',
    type: 'number',
    required: false,
    description: 'number of entries returned per query',
    example: 10,
  })
  @ApiQuery({
    name: 'page',
    type: 'number',
    required: false,
    description:
      'The position of the page number that you want the api to return ',
    example: 1,
  })
  @ApiBearerAuth('access-token')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  public async getAllAddresses(@Query() query: GetAddressQueryDto) {
    return this.addressService.getAddresses(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Fetches a specific Address by UUID' })
  @ApiNotFoundResponse({
    description: 'User not found.',
  })
  @ApiOkResponse({ type: ResponseAddressDto })
  @ApiParam({
    name: 'id',
    example: '7aa02917-e3b5-4e83-9849-352f0c8dff2e',
  })
  @ApiBearerAuth('access-token')
  @UseGuards(OwnershipOrAdminGuard)
  @CheckOwnership({ resource: 'address' })
  public async getAddressById(@Param() params: GetUserAddressParamDto) {
    return this.addressService.getAddressById(params.userId);
  }

  @Patch('user/:userId')
  @ApiOperation({ summary: 'patches a specific users address (self or admin)' })
  @ApiResponse({
    status: 200,
    description: 'Address updated',
    type: ResponseAddressDto,
  })
  @ApiParam({
    name: 'id',
    example: '7aa02917-e3b5-4e83-9849-352f0c8dff2e',
  })
  @ApiBody({ type: UpdateAddressDto })
  @UseGuards(OwnershipOrAdminGuard)
  @CheckOwnership({ resource: 'address' })
  public async updateAddress(
    @Param() params: GetUserAddressParamDto,
    @Body() updateAddressDto: UpdateAddressDto,
  ) {
    return await this.addressService.updateAddressForUser(
      params.userId,
      updateAddressDto,
    );
  }

  @Delete('user/:userId')
  @ApiOperation({ summary: "Delete a specific user's address (self or admin)" })
  @UseGuards(OwnershipOrAdminGuard)
  @CheckOwnership({ resource: 'user', paramName: 'userId' })
  @ApiBearerAuth('access-token')
  public async deleteAddressForUser(@Param() params: GetUserAddressParamDto) {
    await this.addressService.deleteAddressForUser(params.userId);
  }
}
