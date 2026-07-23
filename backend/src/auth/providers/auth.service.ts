import { Injectable, Inject, forwardRef, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../../users/providers/users.service';
import { AuthDto } from '../dto/auth.dto';
import { DatabaseService } from '../../database/providers/database.service';
import * as bcrypt from "bcrypt"
import { HashingService } from '../../common/hashing/providers/hashing.service';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
@Injectable()
export class AuthService {
  constructor(
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
    private readonly dbService: DatabaseService,
    private readonly jwtService: JwtService,
    private readonly hashingService: HashingService 
  ) {}


  public async login(authDto: AuthDto) {
    const user = await this.usersService.getUserByEmail(authDto.email)
    
    if(!user){
      throw new UnauthorizedException('Invalid credentials')
    }

    const isPasswordValid = await this.hashingService.comparePassword(authDto.password, user.password_hash)
    
    if(!isPasswordValid){
      throw new UnauthorizedException('Invalid credentials')
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role
    }
    

    return {
      access_token: this.jwtService.sign(payload),
      user:{
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role
      }
    }
  }

  public isAuthenticated(token: string): boolean {
    try{
      this.jwtService.verify(token)
      return true;
    }catch{
      return false;
    }
  }
}
