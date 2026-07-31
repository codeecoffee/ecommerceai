import { Injectable, NotFoundException } from '@nestjs/common';
import { GetPostParamDto } from '../dto/get-post-param.dto';
import { UsersService } from '../../users/providers/users.service';
import { DatabaseService } from '../../database/providers/database.service';
import { Post, Prisma } from '../../../prisma/src/generated/prisma/client';
import { CreatePostDto } from '../dto/create-post.dto';
import { PostsMapper } from '../mappers/posts.mapper';
import { UpdatePostDto } from '../dto/update-post.dto';
import { ResponsePostDto } from '../dto/response-post-dto';

@Injectable()
export class PostsService {

    constructor(
        private readonly usersService: UsersService, 
        private readonly dbService: DatabaseService,
        private readonly postMapper: PostsMapper 
    ){}

    public async createReview(productId: string, dto: CreatePostDto, authorId: string): Promise<ResponsePostDto>{
        const product = await this.dbService.product.findUnique({
            where: { prod_id: productId },
            select: { prod_id: true }
        })

        if(!product) throw new NotFoundException(`Product with id ${productId} not found`);

        try {
            const review = await this.dbService.post.create({
                data: PostsMapper.toCreateInput(dto, authorId, productId),  
                include: {author: {select: { id:true, first_name: true, last_name: true } } }    
            })
            return PostsMapper.toResponseDto(review)
        } catch(error){
            if(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003'){
                throw new NotFoundException(`Product with id ${productId} no longer exists`)
            }
            throw error
        }

    }

    // public async getPostsByAuthorId(authorId: string)
    // {
    //     return await this.dbService.post.findMany({
    //         where: {author_id: authorId}
    //     })
    // }

    // public async getPost(postId: string){
    //     return await this.dbService.post.findUnique({where: {post_id:postId}})
    // }

    // public async updatePost(postId: string, dto: UpdatePostDto)
    // {
    //     const data: Prisma.PostUncheckedUpdateInput = this.postMapper.mapCommonFields(dto)
    //     return await this.dbService.post.update({
    //         where: { post_id : postId },
    //         data,
    //     })
    // }

    // public async deletePost(postId: string){
    //     return await this.dbService.post.delete({
    //         where:{post_id : postId}
    //     })
    // }

}
