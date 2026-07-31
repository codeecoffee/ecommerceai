import { ApiProperty } from "@nestjs/swagger";
import { Expose } from "class-transformer";
import { IsUUID } from "class-validator";

export class ResponsePostDto {
    @ApiProperty({description: 'Post UUID'})
    @Expose()
    postId!: string;
    
    @ApiProperty({description: 'Authors info'})
    @Expose()
    author!:{
        id: string
        firstName: string
        lastName: string
    };

    @ApiProperty({ description: 'Post title'})
    @Expose()
    title!: string;

    @ApiProperty({ description: 'Product rating'})
    @Expose()
    rating!: number;
    
    @ApiProperty({ description: 'Product comments'})
    @Expose()
    comment?: string | null;


    @ApiProperty({ description: "Date when Post was created"})
    @Expose()
    createdAt!: Date;

    @ApiProperty({ description: "Date when Post was last updated"})
    @Expose()
    updatedAt!: Date;
}


