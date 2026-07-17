import { Injectable, Inject, forwardRef } from "@nestjs/common";
import { Prisma } from "../../../prisma/src/generated/prisma/client";
import { AuthService } from "../../auth/providers/auth.service";
import { DatabaseService } from "../../database/providers/database.service";
import { GetUsersParamDto } from "../dto/get-user-param.dto";
import { CreateUserDto } from "../dto/create-user-param.dto";

@Injectable()
export class UsersService {
    
    constructor(
        @Inject(forwardRef(()=>AuthService))
        private readonly authService: AuthService,
        private readonly dbService: DatabaseService
    ){}

    private async mapDtoToPrismaInput(dto: CreateUserDto): Promise<Prisma.UserUncheckedCreateInput>{
        return{
            first_name: dto.firstName,
            last_name: dto.lastName,
            email: dto.email,
            photo_url: dto.photoUrl,
            address_id:dto.addressId,
            role:dto.role,
            password_hash: 'Test1234'
        }
    }

    public async createUser(dto: CreateUserDto){
        const data = await this.mapDtoToPrismaInput(dto)
        return await this.dbService.user.create({data})
    }
    
    public getUsers() {
        // const isAuthenticated = this.authService.isAuthenticated('jwt-token');
        // if (!isAuthenticated) {
        //     throw new Error('Unauthorized');
        // }
        return this.dbService.user.findMany()
    
    }
    public getUserById(id: string) {
        return this.dbService.user.findUnique({where:{id}})
    }
}