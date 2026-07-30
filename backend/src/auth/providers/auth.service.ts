import { Injectable, Inject, forwardRef, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../../users/providers/users.service';
import { AuthDto } from '../dto/auth.dto';
import { DatabaseService } from '../../database/providers/database.service';
import * as bcrypt from "bcrypt"
import { HashingService } from '../../common/hashing/providers/hashing.service';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
@Injectable()
export class AuthService {
  constructor(
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
    private readonly dbService: DatabaseService,
    private readonly jwtService: JwtService,
    private readonly hashingService: HashingService,
    private readonly configService: ConfigService
  ) {}

  public async issueToken(payload: JwtPayload){
    const access_token = this.jwtService.sign(payload,{
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: Number(this.configService.get<string>('JWT_EXPIRES_IN', '3600'))
    })

    const refresh_token = this.jwtService.sign(
      { sub: payload.sub, jti: randomUUID() },
      {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: Number(this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '604800'))
      }
    
    )

    const token_hash = await this.hashingService.hash(refresh_token)
    const expires_at = new Date(
      Date.now() + Number(this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '604800'))
    )

    await this.dbService.refreshToken.create({
      data: { token_hash, user_id: payload.sub, expires_at}
    })

    return { access_token, refresh_token }

  }

  public async login(authDto: AuthDto) {
    const user = await this.usersService.findUserWithPassHash(authDto.email)
    
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
    const tokens = await this.issueToken(payload)
    

    return {
      ...tokens,
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

  public async refresh(refreshTokenDto: RefreshTokenDto){
    const { refresh_token } = refreshTokenDto

    let payload: { sub: string, jti: string }

    try{
      payload = this.jwtService.verify(refresh_token,{
        secret: this.configService.get<string>('JWT_REFRESH_SECRET')
      })
    }catch{
      throw new UnauthorizedException('Invalid or expired refresh token')
    }

    //Check all stored tokens for user by comparing hashes

    const storedTokens = await this.dbService.refreshToken.findMany({
      where:{ user_id: payload.sub, expires_at: { gt: new Date()} }
    })

    let matchedToken: (typeof storedTokens)[number] | undefined
    
    for (const stored of storedTokens){
      if (await this.hashingService.comparePassword(refreshTokenDto.refresh_token, stored.token_hash)){
        matchedToken = stored
        break
      }
    }
    if(!matchedToken) throw new UnauthorizedException('Refresh token has been revoked')
    
    //Rotate token: delete old one, issue a fresh pair
    await this.dbService.refreshToken.delete({ where: { id: matchedToken.id } })
    
    const user = await this.usersService.getUserById(payload.sub)
    if(!user) throw new UnauthorizedException(' User no longer exists')

    const newPayload: JwtPayload = { sub: user.id, email: user.email, role: user.role }

    return this.issueToken(newPayload)
  }

  public async logout(userId: string, refreshTokenDto: RefreshTokenDto){
    const storedTokens = await this.dbService.refreshToken.findMany({
      where: { user_id: userId }
    })

    for( const stored of storedTokens ){
      if (await this.hashingService.comparePassword(refreshTokenDto.refresh_token,stored.token_hash)){
        await this.dbService.refreshToken.delete({ where: { id: stored.id } })
        break
      }
    }
    return { message: " Logged out successfully "}
  }
}
