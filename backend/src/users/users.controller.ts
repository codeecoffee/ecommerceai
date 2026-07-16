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
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger'
@Controller('users')
@ApiTags('Users')
export class UsersController {

  constructor(private readonly userService: UsersService) {}

  @Get()
  @ApiOperation({
    summary: "Fetches a list of registered users on the application"
  })
  @ApiResponse({
    status: 200,
    description: " Users fetched successfully based on query"
  })
  @ApiQuery({
    name: 'limit',
    type: 'number',
    required: false,
    description: 'number of entries returned per query',
    example: 10
  })
    @ApiQuery({
    name: 'page',
    type: 'number',
    required: false,
    description: 'The position of the page number that you want the api to return ',
    example: 1
  })
  public getUsers(){
    return 'user'
  }
  // public getUsers(
  //   @Param() getUserParamDto: GetUsersParamDto,
  //   @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
  //   @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  // ) 
  // {
  //   return this.userService.findAllUsers(getUserParamDto, limit, page);
  // }

  @Post()
    @ApiOperation({
    summary: "Creates a new User"
  })
  public createUser(@Body() createUserInput: CreateUserDto){
    return this.userService.createUser(createUserInput)
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
