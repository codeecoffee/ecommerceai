import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { OwnershipOrAdminGuard } from '../auth/guards/ownership-or-admin.guard';
import { GetAddressQueryDto } from './dto/get-address-query.dto';
import { ResponseAddressDto } from './dto/response-address.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetAddressParamDto } from './dto/get-address-param.dto';
import { CheckOwnership } from '../auth/decorators/check-ownership.decorator';

@Controller('address')
@ApiTags('Address')
export class AddressController {
  constructor(private readonly addressService: AddressService) {}

  @Post()
  @ApiOperation({ summary: 'Creates a new Address' })
  @ApiBody({ type: CreateAddressDto })
  @ApiResponse({
    status: 201,
    description: 'Address created successfully',
  })
  @UseGuards(OwnershipOrAdminGuard)
  @CheckOwnership({ resource: 'address' })
  @ApiBearerAuth('access-token')
  public createAddress(
    @Body() createAddressDto: CreateAddressDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.addressService.createAddress(createAddressDto, user.id);
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
  public async getAddressById(@Param('id') id: string) {
    return this.addressService.getAddressById(id);
  }

  //TODO!: Create a route for admin to receive all address info

  @Patch(':id')
  @ApiOperation({ summary: 'patches a specific Address' })
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
    @CurrentUser() user: { id: string },
    @Body() updateAddressDto: UpdateAddressDto,
  ) {
    return this.addressService.updateAddressForUser(user.id, updateAddressDto);
  }

  @Delete(':id/force')
  @ApiOperation({
    summary:
      'Admin: force-delete an address regardless of current occupancy or order history',
  })
  @ApiResponse({ status: 204, description: 'No Content' })
  @ApiParam({ name: 'id', example: '7aa02917-e3b5-4e83-9849-352f0c8dff2e' })
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  public async forceDeleteAddress(@Param() params: GetAddressParamDto) {
    return this.addressService.forceDeleteAddress(params.id);
  }
}
