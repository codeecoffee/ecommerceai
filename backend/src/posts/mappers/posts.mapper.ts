import { Injectable } from '@nestjs/common';
import {
  Post,
  Prisma,
  User,
} from '../../../prisma/src/generated/prisma/client';
import { CreatePostDto } from '../dto/create-post.dto';
import { UpdatePostDto } from '../dto/update-post.dto';
import { ResponsePostDto } from '../dto/response-post-dto';

@Injectable()
export class PostsMapper {
  static toCreateInput(
    dto: CreatePostDto,
    authorId: string,
    productId: string,
  ): Prisma.PostUncheckedCreateInput {
    return {
      title: dto.title,
      rating: dto.rating,
      comment: dto.comment,
      author_id: authorId,
      product_id: productId,
    };
  }

  static toResponseDto(
    post: Post & { author: Pick<User, 'id' | 'first_name' | 'last_name'> },
  ): ResponsePostDto {
    return {
      postId: post.post_id,
      title: post.title,
      rating: post.rating,
      comment: post.comment,
      author: {
        id: post.author.id,
        firstName: post.author.first_name,
        lastName: post.author.last_name,
      },
      createdAt: post.created_at,
      updatedAt: post.updated_at,
    };
  }

  // model Post {
  //   post_id    String   @id @default(uuid())
  //   author     User     @relation(fields: [author_id], references: [id])
  //   author_id  String
  //   title      String
  //   rating     Int
  //   comment    String?
  //   product    Product  @relation(fields: [product_id], references: [prod_id])
  //   product_id String
  //   created_at DateTime @default(now())
  //   updated_at DateTime @updatedAt
  // }

  // mapCommonFields(
  //     dto: CreatePostDto
  // ): Required<Pick<Prisma.PostUncheckedCreateInput, 'title' | 'product_id' | 'rating' >>
  // & Pick<Prisma.PostUncheckedCreateInput, 'comment'>;

  // mapCommonFields(
  //     dto: UpdatePostDto
  // ):Required<Pick<Prisma.PostUncheckedUpdateInput, 'title' | 'comment' | 'rating'>>

  // mapCommonFields(
  //     dto: CreatePostDto | UpdatePostDto
  // ):
  //     | (Pick<Prisma.PostUncheckedCreateInput, 'title' | 'product_id' | 'rating'>
  //         &Pick<Prisma.PostUncheckedCreateInput, 'comment'>)
  //     | Partial<Pick<Prisma.PostUncheckedUpdateInput, 'title' | 'comment' | 'rating'>>{
  //     return{
  //         title: dto.title,
  //         comment: dto.comment,
  //         rating: dto.rating,
  //         ...('productId' in dto ? {product_id: dto.productId} : {})
  //     }
  // }
}
