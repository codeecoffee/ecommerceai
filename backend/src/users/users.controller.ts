import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user-param.dto';
import { GetUsersParamDto } from './dto/get-user-param.dto';
import { PatchUserDTO } from './dto/patch-user.dto';
import { UsersService } from './providers/users.service';
import {
    ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { GetUsersQueryDto } from './dto/get-users-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';

@Controller('users')
@ApiTags('Users')
export class UsersController {
  constructor(private readonly userService: UsersService) {}

 
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
  @Get()
  public getUsers(@Query() query: GetUsersQueryDto) {
    return this.userService.getUsers(query);
  }

  @ApiOperation({
    summary: 'Fetches a specific user by UUID',
  })
  @ApiResponse({
    status: 200,
    description: 'User found.',
    type: UserResponseDto
  })
  @ApiParam({
    name: 'id',
    example: '7aa02917-e3b5-4e83-9849-352f0c8dff2e',
  })
  @Get(':id')
  public getUserById(@Param() params: GetUsersParamDto) {
    return this.userService.getUserById(params.id);
  }

  @ApiOperation({
    summary: 'Creates a new User',
  })
  @ApiBody({ type: CreateUserDto })
  @ApiResponse({
    status: 201,
    description: 'User created successfully',
  })
  @Post()
  public createUser(@Body() createUserInput: CreateUserDto) {
    return this.userService.createUser(createUserInput);
  }

  @ApiOperation({summary: 'patches a specific user'})
  @ApiResponse({
    status: 204,
    description: 'No content'
  })
  @ApiParam({
    name: 'id',
    example: '7aa02917-e3b5-4e83-9849-352f0c8dff2e',
  })
  @ApiBody({ type:UpdateUserDto })
  @Patch(':id')
  public patchUser(
    @Body() updateUserDto: UpdateUserDto,
    @Param() params: GetUsersParamDto,
  ) 
  {
    return this.userService.updateUser(params.id, updateUserDto);
  }

  
  @ApiOperation({
    summary: 'Deletes a specific user by UUID',
  })
  @ApiResponse({
    status: 204,
    description: 'No Content',
  })
  @ApiParam({
    name: 'id',
    example: '7aa02917-e3b5-4e83-9849-352f0c8dff2e',
  })
  @Delete(':id')
  public async deleteUser(@Param() params: GetUsersParamDto) {
    return await this.userService.deleteUser(params.id);
  }
}
