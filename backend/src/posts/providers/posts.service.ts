import { Injectable, NotFoundException } from '@nestjs/common';
import { GetPostParamDto } from '../dto/get-post-param.dto';
import { UsersService } from '../../users/providers/users.service';
import { DatabaseService } from '../../database/providers/database.service';
import {
  Post,
  Prisma,
  Product,
} from '../../../prisma/src/generated/prisma/client';
import { CreatePostDto } from '../dto/create-post.dto';
import { PostsMapper } from '../mappers/posts.mapper';
import { UpdatePostDto } from '../dto/update-post.dto';
import { ResponsePostDto } from '../dto/response-post-dto';
import { GetUserPostsParamDto } from '../dto/get-user-posts-param.dto';
import { GetPostsQueryDto } from '../dto/get-posts-query.dto';
import { PaginatedResponseDto } from '../../common/dto/response-paginated.dto';

const AUTHOR_SELECT = {
  id: true,
  first_name: true,
  last_name: true,
} as const;

@Injectable()
export class PostsService {
  constructor(
    private readonly usersService: UsersService,
    private readonly dbService: DatabaseService,
    private readonly postMapper: PostsMapper,
  ) {}
  public async createPost(
    productId: string,
    dto: CreatePostDto,
    authorId: string,
  ): Promise<ResponsePostDto> {
    const product = await this.dbService.product.findUnique({
      where: { prod_id: productId },
      select: { prod_id: true },
    });

    if (!product)
      throw new NotFoundException(`Product with id ${productId} not found`);

    try {
      const review = await this.dbService.post.create({
        data: PostsMapper.toCreateInput(dto, authorId, productId),
        include: {
          author: { select: { id: true, first_name: true, last_name: true } },
        },
      });
      return PostsMapper.toResponseDto(review);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new NotFoundException(
          `Product with id ${productId} no longer exists`,
        );
      }
      throw error;
    }
  }

  public async getAllPostsForProd(
    productId: string,
    query: GetPostsQueryDto,
  ): Promise<PaginatedResponseDto<ResponsePostDto>> {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;
    const [reviews, total] = await Promise.all([
      this.dbService.post.findMany({
        where: { product_id: productId },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: { author: { select: AUTHOR_SELECT } },
      }),
      this.dbService.post.count({ where: { product_id: productId } }),
    ]);

    return {
      data: reviews.map((post) => PostsMapper.toResponseDto(post)),
      metadata: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  public async getPostById(postId: string): Promise<ResponsePostDto> {
    const post = await this.dbService.post.findUnique({
      where: { post_id: postId },
      include: { author: { select: AUTHOR_SELECT } },
    });
    if (!post)
      throw new NotFoundException(`Product with id ${postId} not found`);
    return PostsMapper.toResponseDto(post);
  }

  // --- Read: list by author, across products ---
  public async getPostsByAuthor(
    authorId: string,
    query: GetPostsQueryDto,
  ): Promise<PaginatedResponseDto<ResponsePostDto>> {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;
    const [reviews, total] = await Promise.all([
      this.dbService.post.findMany({
        where: { author_id: authorId },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: { author: { select: AUTHOR_SELECT } },
      }),
      this.dbService.post.count({ where: { author_id: authorId } }),
    ]);
    return {
      data: reviews.map((post) => PostsMapper.toResponseDto(post)),
      metadata: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  public async updatePost(
    postId: string,
    dto: UpdatePostDto,
  ): Promise<ResponsePostDto> {
    try {
      const post = await this.dbService.post.update({
        where: { post_id: postId },
        data: PostsMapper.toUpdateDto(dto),
        include: { author: { select: AUTHOR_SELECT } },
      });
      return PostsMapper.toResponseDto(post);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`Product with id ${postId} not found`);
      }
      throw error;
    }
  }

  public async deletePost(postId: string): Promise<void> {
    try {
      await this.dbService.post.delete({ where: { post_id: postId } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`Product with id ${postId} not found`);
      }
      throw error;
    }
  }


}
