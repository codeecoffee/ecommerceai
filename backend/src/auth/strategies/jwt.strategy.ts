import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from '@nestjs/config'
import { UsersService } from "../../users/providers/users.service";
import { JwtPayload } from "../interfaces/jwt-payload.interface";


@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy){
    constructor(
        configService: ConfigService,
        private readonly userService: UsersService
    ){
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration:false,
            secretOrKey: configService.get<string>('JWT_SECRET')!
        })
    }

    public async validate(payload: JwtPayload){
        const user = await this.userService.getUserById(payload.sub)
        if(!user){
            throw new UnauthorizedException('User does not exist')
        }
        const { password_hash, ...safeUser } = user;
        return safeUser;
    }

}