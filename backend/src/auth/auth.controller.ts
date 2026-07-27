import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './providers/auth.service';
import { AuthDto } from './dto/auth.dto';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from './decorators/public.decorator';

@Controller('auth')
@ApiTags('Auth')
export class AuthController {
    constructor(private readonly authService: AuthService){}
    
    @Public()
    @Post('login')
    @ApiOperation({summary: "Authenticate a user and receive an access token"})
    @ApiResponse({status: 200, description: "Login successful"})
    @ApiResponse({ status: 401, description: "Invaild credentials"})
    public login(@Body() authDto: AuthDto)
    {
        return this.authService.login(authDto)
    }
    
    @Post('/logout')
    public logout(){}

    @Post('/refresh')
    public refreshTokens(){}

}
