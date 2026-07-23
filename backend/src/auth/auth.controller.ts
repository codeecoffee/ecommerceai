import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './providers/auth.service';
import { AuthDto } from './dto/auth.dto';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService){}

    //login with email and password

    

    @Post('signin')
    public signinLocal(@Body() authDto: AuthDto)
    {

    }
    
    @Post('/logout')
    public logout(){}

    @Post('/refresh')
    public refreshTokens(){}

}
