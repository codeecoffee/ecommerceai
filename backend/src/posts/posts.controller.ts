import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  Post,
  Query,
  Body,
  ParseIntPipe,
  Patch,
  Delete,
} from '@nestjs/common';
import { PostsService } from './providers/posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import {
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { GetPostParamDto } from './dto/get-post-param.dto';
import { GetUserPostsParamDto } from './dto/get-user-posts-param.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostResponseDto } from './dto/response-post-dto';

@Controller('posts')
@ApiTags('Posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  // @ApiOperation({summary: "Creates a new post written by the logged in User"})
  // @ApiBody({ type: CreatePostDto })
  // @ApiOkResponse({description: 'Post created successfully'})
  // @Post()
  // public createPost(@Body() createPostDto: CreatePostDto){
  //     return this.postsService.createPost(createPostDto);
  // }

  // @ApiOperation({
  //     summary: 'Retrieve posts from an specific user'
  // })
  // @ApiResponse({
  //     status: 200,
  //     description: 'List of posts by author',
  //     type: PostResponseDto,
  //     isArray: true
  // })
  // @ApiParam({
  //     name: 'author_id',
  //     example: '7aa02917-e3b5-4e83-9849-352f0c8dff2e',

  // })
  // @Get(':userId/posts')
  // public getPostsByUser(@Param() params: GetUserPostsParamDto){
  //     return this.postsService.getPostsByAuthorId(params.authorId)
  // }

  // @ApiOperation({
  //     summary: 'Fetches a specific post by UUID',
  // })
  // @ApiResponse({
  //     status: 200,
  //     description: 'Post found.',
  //     type: PostResponseDto
  // })
  // @ApiParam({
  //     name: 'post_id',
  //     example: '7aa02917-e3b5-4e83-9849-352f0c8dff2e',

  // })
  // @Get(':postId')
  // public getPost(@Param() params: GetPostParamDto){
  //     return this.postsService.getPost(params.postId)
  // }

  // @ApiOperation({summary: 'patches a specific post'})
  // @ApiResponse({
  //     status: 204,
  //     description: 'No content'
  // })
  // @ApiParam({
  //     name: 'id',
  //     example: '7aa02917-e3b5-4e83-9849-352f0c8dff2e',
  // })
  // @ApiBody({ type: UpdatePostDto })
  // @Patch(':postId')
  // public patchPost(
  //     @Param() params: GetPostParamDto,
  //     @Body() updatePostDto: UpdatePostDto
  // ){
  //     return this.postsService.updatePost(params.postId,updatePostDto)
  // }

  // @ApiOperation({
  //     summary: 'Deletes a specific post by UUID',
  // })
  // @ApiResponse({
  //     status: 204,
  //     description: 'No Content',
  // })
  // @ApiParam({
  //     name: 'id',
  //     example: '7aa02917-e3b5-4e83-9849-352f0c8dff2e',
  // })
  // @Delete(':postId')
  // public deletePost(@Param() params: GetPostParamDto){
  //     return this.postsService.deletePost(params.postId)
  // }
}

/*

0- create a post for a product - a post must have a prod and be by the logged in user
1- get all posts by author (ADMIN)
1.2- get all posts on a product ()
1.5- get all posts paginated (ADMIN)
2- get a post by id 
3- edit a post by author / admin 
4- Delete a post by id (self/ admin)

*/
