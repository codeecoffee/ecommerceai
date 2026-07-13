import { Injectable } from "@nestjs/common";
import { GetUsersParamDto } from "../dto/get-users-param.dto";

@Injectable()
export class UsersService {
    
    public findAllUsers(getUserParamDto: GetUsersParamDto, limit: number, page: number) {
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