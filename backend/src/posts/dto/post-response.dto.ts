import { Expose } from "class-transformer";

export class PostResponseDto {
    @Expose()
    postId!: string;
    
    @Expose()
    authorId!: string;
    
    @Expose()
    rating!: number;
    
    @Expose()
    comment!: string;
    
    @Expose()
    productId!: string;

    @Expose()
    createdAt!: Date;

    @Expose()
    updatedAt!: Date;
}


