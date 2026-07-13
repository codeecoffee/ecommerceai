import { Injectable } from '@nestjs/common';
import { GetPostsParamDto } from '../dto/get-posts-param.dto';

@Injectable()
export class PostsService {
    createPost(createPostDto: any): string {
        console.log('createPostDto', createPostDto);
        return 'You sent a new post';
    }

    getPosts(getPostsParamDto: GetPostsParamDto, limit: number, page: number){
        return [
            {
                title: 'Post 1',
                content: 'Content of post 1',
                authorId: 1,
            },
            {
                title: 'Post 2',
                content: 'Content of post 2',
                authorId: 2,
            }
        ]
    }
}
