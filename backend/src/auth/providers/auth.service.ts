import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { UsersService } from '../../users/providers/users.service';

@Injectable()
export class AuthService {
    
    constructor(@ Inject(forwardRef(()=>UsersService))private readonly usersService: UsersService) {}

    public login(email: string, password: string, id: number) {
        const user = this.usersService.findUserById(id);
        return {token: 'jwt-token', user};
    }
    public isAuthenticated(token: string):boolean {

        return true;
    }

}
