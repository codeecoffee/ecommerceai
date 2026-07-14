import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user-param.dto';
import { GetUsersParamDto } from './dto/get-users-param.dto';
import { PatchUserDTO } from './dto/patch-user.dto';
import { UsersService } from './providers/users.service';
import { ApiQuery, ApiTags } from '@nestjs/swagger'
@Controller('users')
@ApiTags('Users')
export class UsersController {

  constructor(private readonly userService: UsersService) {}

  @Get()
  @ApiQuery({
    name: 'limit',
    type: 'number',
    required: false,
    description: 'number of entries returned per query',
    example: 10
  })
  public getUsers(
    @Param() getUserParamDto: GetUsersParamDto,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) 
  {
    return this.userService.findAllUsers(getUserParamDto, limit, page);
  }

  @Post()
  public createUsers(@Body() createUserDto: CreateUserDto): string {
    console.log('body', createUserDto);
    return 'You sent a new user';
  }

  @Patch()
  public patchUser(@Body() patchUserDto: PatchUserDTO) {
    console.log('patchUserDto', patchUserDto);
  }

  @Delete()
  public deleteUser(@Body() deleteUserDto: PatchUserDTO) {
    console.log('deleteUserDto', deleteUserDto);
  }
}
