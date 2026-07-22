import { ApiProperty } from "@nestjs/swagger";
import { Expose } from "class-transformer";
import { IsUUID } from "class-validator";

export class PostResponseDto {
    @ApiProperty({description: 'Post UUID'})
    @Expose()
    postId!: string;
    
    @ApiProperty({description: 'Authors UUID'})
    @Expose()
    authorId!: string;
    
    @ApiProperty({ description: 'Product rating'})
    @Expose()
    rating!: number;
    
    @ApiProperty({ description: 'Product comments'})
    @Expose()
    comment!: string;
    
    @ApiProperty({ description: "Product UUID"})
    @Expose()
    @IsUUID()
    productId!: string;

    @ApiProperty({ description: "Date when Post was created"})
    @Expose()
    createdAt!: Date;

    @ApiProperty({ description: "Date when Post was last updated"})
    @Expose()
    updatedAt!: Date;
}


