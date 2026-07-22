import { Injectable } from '@nestjs/common';
import { GetPostParamDto } from '../dto/get-post-param.dto';
import { UsersService } from '../../users/providers/users.service';
import { DatabaseService } from '../../database/providers/database.service';

@Injectable()
export class PostsService {

    constructor(
        private readonly usersService: UsersService, 
        private readonly dbService: DatabaseService
    ){}

    





    // getPosts(getPostsParamDto: GetPostsParamDto, limit: number, page: number, userId: number) {
    //     const user = this.usersService.findUserById(userId);
    //     return [
    //         {
    //             user: user,
    //             title: 'Post 1',
    //             content: 'Content of post 1',
    //             authorId: 1,
    //         },
    //         {
    //             user: user,
    //             title: 'Post 2',
    //             content: 'Content of post 2',
    //             authorId: 2,
    //         }
    //     ]
    // }


}
