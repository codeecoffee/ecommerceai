import { Controller, DefaultValuePipe, Get, Param, Post, Query, Body, ParseIntPipe, Patch, Delete } from '@nestjs/common';
import { PostsService } from './providers/posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GetPostParamDto } from './dto/get-post-param.dto';
import { GetUserPostsParamDto } from './dto/get-user-posts-param.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostResponseDto } from './dto/post-response.dto';


@Controller('posts')
@ApiTags('Posts')
export class PostsController {
    constructor(private readonly postsService: PostsService) {}

    @ApiOperation({
        summary: "Creates a new post written by the logged in User",
    })
    @ApiBody({ type: CreatePostDto })
    @ApiResponse({
        status: 201,
        description: 'Post created successfully'
    })
    @Post()
    public createPost(@Body() createPostDto: CreatePostDto){
        //console.log('body', createPostDto);
        return this.postsService.createPost(createPostDto);
    }

    @ApiOperation({
        summary: 'Retrieve posts from an specific user'
    })
    @ApiResponse({
        status: 200,
        description: 'List of posts by author',
        type: PostResponseDto,
        isArray: true
    })
    @ApiParam({
        name: 'id',
        example: '7aa02917-e3b5-4e83-9849-352f0c8dff2e',
    })
    @Get(':userId/posts')
    public getPostsByUser(@Param() params: GetUserPostsParamDto){
        return this.postsService.getPostsByAuthorId(params.authorId)
    }

    @ApiOperation({
        summary: 'Fetches a specific post by UUID',
    })
    @ApiResponse({
        status: 200,
        description: 'Post found.',
        type: PostResponseDto
    })
    @ApiParam({
        name: 'id',
        example: '7aa02917-e3b5-4e83-9849-352f0c8dff2e',
    })
    @Get(':postId')
    public getPost(@Param() params: GetPostParamDto){
        return this.postsService.getPost(params.postId)
    }

    @ApiOperation({summary: 'patches a specific post'})
    @ApiResponse({
        status: 204,
        description: 'No content'
    })
    @ApiParam({
        name: 'id',
        example: '7aa02917-e3b5-4e83-9849-352f0c8dff2e',
    })
    @ApiBody({ type: UpdatePostDto })
    @Patch(':postId')
    public patchPost(
        @Param() params: GetPostParamDto,
        @Body() updatePostDto: UpdatePostDto
    ){
        return this.postsService.updatePost(params.postId,updatePostDto)
    }

    @ApiOperation({
        summary: 'Deletes a specific post by UUID',
    })
    @ApiResponse({
        status: 204,
        description: 'No Content',
    })
    @ApiParam({
        name: 'id',
        example: '7aa02917-e3b5-4e83-9849-352f0c8dff2e',
    })
    @Delete(':postId')
    public deletePost(@Param() params: GetPostParamDto){
        return this.postsService.deletePost(params.postId)
    }

    // @Get('posts')
    // public getPosts(
    //     @Param() getPostsParamDto: GetPostsParamDto,
    //     @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    //     @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number
    // )
    // {
    //     return this.postsService.getPosts(getPostsParamDto, limit, page);
    // }

    // @Get('posts/:authorId')
    // public getPostsByAuthorId(
    //     @Param('authorId', ParseIntPipe) authorId: number,
    //     @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    //     @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number
    // ){
    //     return this.postsService.getPosts({ authorId }, limit, page);
    // }
}
