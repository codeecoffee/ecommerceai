import { Controller, Get, Param, Post } from '@nestjs/common';

@Controller('users')
export class UsersController {
  @Get()
  public getUsers() {
    return 'You sent a get request to Users';
  }
  @Get('/:id/{:optional}')
  public getUserById(@Param('id') id: string) {
    return 'You sent a get user by id to users';
  }
  @Post()
  public createUsers(): string {
    return 'You sent a new user';
  }
}
