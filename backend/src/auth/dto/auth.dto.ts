import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsString, MinLength } from "class-validator";

export class AuthDto{
    @ApiProperty({example: 'tomas.turbando@example.com'})
    @IsEmail()
    @IsNotEmpty()
    email!: string;

    @ApiProperty({example: '12345678Admin!'})
    @IsString()
    @IsNotEmpty()
    @MinLength(8)
    password!: string;

}