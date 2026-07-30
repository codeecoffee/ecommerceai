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
import { CreateUserDto } from './dto/create-user.dto';
import { GetUsersParamDto } from './dto/get-user-param.dto';
import { UsersService } from './providers/users.service';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { GetUsersQueryDto } from './dto/get-users-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/response-user.dto';
import { Public } from '../auth/decorators/public.decorator';
import { OwnershipOrAdminGuard } from '../auth/guards/ownership-or-admin.guard';
import { OptionalAdminGuard } from '../auth/guards/optional-admin.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { plainToInstance } from 'class-transformer';

@Controller('users')
@ApiTags('Users')
export class UsersController {
  constructor(private readonly userService: UsersService) {}

  @Post()
  @ApiOperation({ summary: 'Creates a new User' })
  @ApiBody({ type: CreateUserDto })
  @ApiResponse({
    status: 201,
    description: 'User created successfully',
  })
  @Public()
  @UseGuards(OptionalAdminGuard)
  @ApiBearerAuth('access-token')
  public createUser(@Body() createUserInput: CreateUserDto) {
    return this.userService.createUser(createUserInput);
  }

  @Get()
  @ApiOperation({
    summary: 'Fetches a list of registered users on the application',
  })
  @ApiResponse({
    status: 200,
    description: 'Users fetched successfully based on query',
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
  public getUsers(@Query() query: GetUsersQueryDto) {
    return this.userService.getUsers(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Fetches a specific user by UUID' })
  @ApiResponse({
    status: 404,
    description: 'User found.',
    type: UserResponseDto,
  })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiParam({
    name: 'id',
    example: '7aa02917-e3b5-4e83-9849-352f0c8dff2e',
  })
  @ApiBearerAuth('access-token')
  @UseGuards(OwnershipOrAdminGuard)
  public getUserById(@Param() params: GetUsersParamDto) {
    return this.userService.getUserById(params.id);
  }

  @Patch(':id/role')
  @ApiOperation({ summary: 'Admin is able to change an user role' })
  @ApiResponse({ 
    status: 200, 
    description: 'User updated', 
    type: UserResponseDto 
  })
  @ApiParam({
    name: 'id',
    example: '7aa02917-e3b5-4e83-9849-352f0c8dff2e',
  })
  @ApiBody({ type: UpdateUserRoleDto })
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  public patchUserRole(
    @Param() params: GetUsersParamDto,
    @Body() updateRoleDto: UpdateUserRoleDto,
  ) {
    return this.userService.updateUserRole(params.id, updateRoleDto.role);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'patches a specific user' })
  @ApiResponse({ 
    status: 200, 
    description: 'User updated', 
    type: UserResponseDto 
  })
  @ApiParam({
    name: 'id',
    example: '7aa02917-e3b5-4e83-9849-352f0c8dff2e',
  })
  @ApiBody({ type: UpdateUserDto })
  @UseGuards(OwnershipOrAdminGuard)
  public patchUser(
    @Body() updateUserDto: UpdateUserDto,
    @Param() params: GetUsersParamDto,
  ) {
    return this.userService.updateUser(params.id, updateUserDto);
  }


  @Delete(':id')
  @ApiOperation({ summary: 'Deletes a specific user by UUID' })
  @ApiResponse({
    status: 204,
    description: 'No Content',
  })
  @ApiParam({
    name: 'id',
    example: '7aa02917-e3b5-4e83-9849-352f0c8dff2e',
  })
  @UseGuards(OwnershipOrAdminGuard) //Admin can delete an account and user can delete their own account
  public deleteUser(@Param('id') params: GetUsersParamDto) {
    return this.userService.deleteUser(params.id);
  }

  @Delete(':id/address')
  @ApiOperation({ summary: 'Deletes a specific address by user UUID' })
  @ApiResponse({
    status: 204,
    description: 'No Content',
  })
  @ApiParam({
    name: 'id',
    example: '7aa02917-e3b5-4e83-9849-352f0c8dff2e',
  })
  @UseGuards(OwnershipOrAdminGuard) 
  public removeMyAddress(
    @Param() params: GetUsersParamDto
  ){
    return this.userService.removeUserAddress(params.id)
  }
}
