import { Injectable, Inject, forwardRef } from "@nestjs/common";
import { GetUsersParamDto } from "../dto/get-users-param.dto";
import { AuthService } from "../../auth/providers/auth.service";
import { DatabaseService } from "../../database/providers/database.service";
import { Prisma } from "../../../prisma/src/generated/prisma/client";

@Injectable()
export class UsersService {
    
    constructor(
        @Inject(forwardRef(()=>AuthService))
        private readonly authService: AuthService,
        private readonly dbService: DatabaseService
    ){}

    public createUser(createUserData: Prisma.UserCreateInput){
        this.dbService.user.create({data: createUserData})
    }
    
    public findAllUsers(getUserParamDto: GetUsersParamDto, limit: number, page: number) {
        const isAuthenticated = this.authService.isAuthenticated('jwt-token');
        if (!isAuthenticated) {
            throw new Error('Unauthorized');
        }
        return [
            {
                id: 1,
                name: 'John Doe',
                email: 'john@msn.com',
                password: '123456'
            },
            {
                id: 2,
                name: 'Jane Doe',
                email: 'jane@msn.com',
                password: '12345678'
            }
        ]
    
    }
    public findUserById(id: number) {
        return {
            id: 1,
            name: 'John Doe',
            email: 'john@msn.com'
        }
    }
}