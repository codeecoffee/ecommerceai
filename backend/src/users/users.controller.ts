import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { GetUsersParamDto } from './dto/get-users-param.dto';
import { PatchUserDTO } from './dto/patch-user.dto';

@Controller('users')
export class UsersController {
  @Get()
  public getUsers(
    @Param() getUserParamDto: GetUsersParamDto,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit?: number,
  ) {
    console.log(getUserParamDto);
    console.log('limit', limit);
    console.log('page', page);
    return 'You sent a get request to Users';
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
}
