import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PostsService } from './providers/posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UpdatePostDto } from './dto/update-post.dto';
import { ResponsePostDto } from './dto/response-post-dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { OwnershipOrAdminGuard } from '../auth/guards/ownership-or-admin.guard';

import { Public } from '../auth/decorators/public.decorator';
import { GetPostsQueryDto } from './dto/get-posts-query.dto';
import { PaginatedResponseDto } from '../common/dto/response-paginated.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller()
@ApiTags('Posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post('products/:productId/reviews')
  @ApiOperation({ summary: 'Creates a new review post to a product' })
  @ApiBody({ type: CreatePostDto })
  @ApiOkResponse({ description: 'Post created successfully' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  public createPost(
    @Param('productId') productId: string,
    @Body() createPostDto: CreatePostDto,
    @CurrentUser() author: { id: string },
  ): Promise<ResponsePostDto> {
    return this.postsService.createPost(productId, createPostDto, author.id);
  }

  @Get('/products/:productId/reviews')
  @ApiOperation({ summary: 'Show post reviews for a product' })
  @ApiOkResponse({ type: ResponsePostDto })
  @Public()
  public getProductReviews(
    @Param() productId: string,
    @Query() query: GetPostsQueryDto,
  ): Promise<PaginatedResponseDto<ResponsePostDto>> {
    return this.postsService.getAllPostsForProd(productId, query);
  }

  @Get('/posts/:postId')
  @ApiOperation({ summary: 'Fetches a product by Id' })
  @ApiOkResponse({ type: ResponsePostDto })
  @Public()
  public getReviewById(@Param() postId: string): Promise<ResponsePostDto> {
    return this.postsService.getPostById(postId);
  }

  @Get('/users/:authorId/reviews')
  @ApiOperation({ summary: 'Fetches a specific user by UUID' })
  @ApiResponse({
    status: 404,
    description: 'User not found.',
  })
  @ApiOkResponse({ type: ResponsePostDto })
  @ApiParam({
    name: 'id',
    example: '7aa02917-e3b5-4e83-9849-352f0c8dff2e',
  })
  @ApiBearerAuth('access-token')
  @UseGuards(OwnershipOrAdminGuard)
  public getPostsByAuthor(
    @Param() authorId: string,
    @Query() query: GetPostsQueryDto,
  ) {
    return this.postsService.getPostsByAuthor(authorId, query);
  }

  @Patch('/reviews/:reviewId')
  @ApiParam({
    name: 'postId',
    example: '7aa02917-e3b5-4e83-9849-352f0c8dff2e',
  })
  @UseGuards(OwnershipOrAdminGuard)
  @ApiBearerAuth('access-token')
  public updatePost(
    @Param() postId: string,
    @Body() dto: UpdatePostDto,
  ): Promise<ResponsePostDto> {
    return this.postsService.updatePost(postId, dto);
  }

  @Delete('/reviews/:reviewId')
  @ApiOperation({ summary: 'Deletes a specific post by post UUID' })
  @ApiResponse({
    status: 204,
    description: 'No Content',
  })
  @ApiParam({
    name: 'postId',
    example: '7aa02917-e3b5-4e83-9849-352f0c8dff2e',
    type: String(),
  })
  @UseGuards(OwnershipOrAdminGuard)
  @ApiBearerAuth('access-token')
  public deletePost(@Param() postId: string): Promise<void> {
    return this.postsService.deletePost(postId);
  }
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
