import { Injectable, NotFoundException } from '@nestjs/common';
import { GetPostParamDto } from '../dto/get-post-param.dto';
import { UsersService } from '../../users/providers/users.service';
import { DatabaseService } from '../../database/providers/database.service';
import { Prisma } from '../../../prisma/src/generated/prisma/client';
import { CreatePostDto } from '../dto/create-post.dto';
import { PostsMapper } from './posts.mapper';
import { UpdatePostDto } from '../dto/update-post.dto';

@Injectable()
export class PostsService {

    constructor(
        private readonly usersService: UsersService, 
        private readonly dbService: DatabaseService,
        private readonly postMapper: PostsMapper 
    ){}

    public async createPost(dto: CreatePostDto){
        const data: Prisma.PostUncheckedCreateInput ={
            ...this.postMapper.mapCommonFields(dto),
            //!TODO: change this to receive author_id from JWT
            author_id: '7aa02917-e3b5-4e83-9849-352f0c8dff2e'
        }
        return this.dbService.post.create({data})
    }

    public async getPostsByAuthorId(authorId: string)
    {
        return await this.dbService.post.findMany({
            where: {author_id: authorId}
        })
    }

    public async getPost(postId: string){
        return await this.dbService.post.findUnique({where: {post_id:postId}})
    }

    public async updatePost(postId: string, dto: UpdatePostDto)
    {
        const data: Prisma.PostUncheckedUpdateInput = this.postMapper.mapCommonFields(dto)
        return await this.dbService.post.update({
            where: { post_id : postId },
            data,
        })
    }

    public async deletePost(postId: string){
        return await this.dbService.post.delete({
            where:{post_id : postId}
        })
    }

}
