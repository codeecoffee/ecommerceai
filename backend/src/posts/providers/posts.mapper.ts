import { Injectable } from "@nestjs/common";
import { Prisma } from "../../../prisma/src/generated/prisma/client";
import { CreatePostDto } from "../dto/create-post.dto";
import { UpdatePostDto } from "../dto/update-post.dto";

@Injectable()
export class PostsMapper{

    mapCommonFields(
        dto: CreatePostDto
    ): Required<Pick<Prisma.PostUncheckedCreateInput, 'title' | 'product_id' | 'rating' >>
    & Pick<Prisma.PostUncheckedCreateInput, 'comment'>;

    mapCommonFields(
        dto: UpdatePostDto
    ):Required<Pick<Prisma.PostUncheckedUpdateInput, 'title' | 'comment' | 'rating'>>

    mapCommonFields(
        dto: CreatePostDto | UpdatePostDto
    ):
        | (Pick<Prisma.PostUncheckedCreateInput, 'title' | 'product_id' | 'rating'>
            &Pick<Prisma.PostUncheckedCreateInput, 'comment'>)
        | Partial<Pick<Prisma.PostUncheckedUpdateInput, 'title' | 'comment' | 'rating'>>{
        return{
            title: dto.title,
            comment: dto.comment,
            rating: dto.rating,
            ...('productId' in dto ? {product_id: dto.productId} : {})
        }
    }


}