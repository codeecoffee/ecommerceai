import { Injectable, Inject, forwardRef } from "@nestjs/common";
import { Prisma } from "../../../prisma/src/generated/prisma/client";
import { AuthService } from "../../auth/providers/auth.service";
import { DatabaseService } from "../../database/providers/database.service";
import { CreateUserDto } from "../dto/create-user-param.dto";
import { GetUsersQueryDto } from "../dto/get-users-query.dto";

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
    
    //TODO: include auth
    public async getUsers(query: GetUsersQueryDto) {
        // const isAuthenticated = this.authService.isAuthenticated('jwt-token');
        // if (!isAuthenticated) {
        //     throw new Error('Unauthorized');
        // }

        const { page = 1, limit = 20  } = query;
        const skip = (page -1)* limit

        const [users, total] = await Promise.all([
            this.dbService.user.findMany({
                skip,
                take: limit,
                orderBy: { created_at: 'desc'}
            }),
            this.dbService.user.count()
        ])
        
        return {
            data:users,
            metadata: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total/limit)
            }
        }

    }
    public getUserById(id: string) {
        return this.dbService.user.findUnique({where:{id}})
    }
}