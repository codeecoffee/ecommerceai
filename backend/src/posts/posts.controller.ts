import { Controller, DefaultValuePipe, Get, Param, Post, Query, Body, ParseIntPipe } from '@nestjs/common';
import { PostsService } from './providers/posts.service';
import { CreatePostDto } from './dto/create-post-param.dto';
import { GetPostsParamDto } from './dto/get-posts-param.dto';

@Controller('posts')
export class PostsController {
    constructor(private readonly postsService: PostsService) {}

    @Post()
    public createPost(@Body() createPostDto: CreatePostDto): string {
        console.log('body', createPostDto);
        return this.postsService.createPost(createPostDto);
    }

    @Get('posts')
    public getPosts(
        @Param() getPostsParamDto: GetPostsParamDto,
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number
    )
    {
        return this.postsService.getPosts(getPostsParamDto, limit, page);
    }

    @Get('posts/:authorId')
    public getPostsByAuthorId(
        @Param('authorId', ParseIntPipe) authorId: number,
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number
    ){
        return this.postsService.getPosts({ authorId }, limit, page);
    }
}
