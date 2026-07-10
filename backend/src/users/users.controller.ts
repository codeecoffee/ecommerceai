import { Controller, Get, Param, Query, Post, Body, Req, ParseIntPipe, Ip, Headers } from '@nestjs/common';
import type { Request } from 'express';
@Controller('users')
export class UsersController {
  @Get()
  public getUsers(
      @Param('id', ParseIntPipe) id: number | undefined,
      @Query('page', ParseIntPipe) optional?: number | undefined,
      @Query('limit', ParseIntPipe) limit?: number,
    ) 
  {
    return 'You sent a get request to Users';
  }

  @Post()
  public createUsers(@Req() request: Request, @Headers() headers: any, @Ip() ip:string): string {
    console.log('request', request);
    console.log('headers', headers);
    console.log('ip', ip);
    return 'You sent a new user';
  }
}
