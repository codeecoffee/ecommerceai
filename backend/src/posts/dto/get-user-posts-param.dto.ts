import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";

export class GetUserPostsParamDto {
    @ApiProperty({
        description: " Get all posts by an author (user) UUID",
        example: "7aa02917-e3b5-4e83-9849-352f0c8dff2e"
    })

    @IsUUID()
    authorId!: string;
}