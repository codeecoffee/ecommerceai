import { Injectable } from '@nestjs/common';
import { GetPostsParamDto } from '../dto/get-posts-param.dto';
import { UsersService } from '../../users/providers/users.service';

@Injectable()
export class PostsService {

    constructor(private readonly usersService: UsersService){}

    createPost(createPostDto: any): string {
        console.log('createPostDto', createPostDto);
        return 'You sent a new post';
    }

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
