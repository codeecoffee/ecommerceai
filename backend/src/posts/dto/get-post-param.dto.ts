import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsUUID } from "class-validator";

export class GetPostParamDto{
    @ApiPropertyOptional({
        description: "Get a post by post UUID",
        example: "7aa02917-e3b5-4e83-9849-352f0c8dff2e",
    })
    @IsUUID()
    postId!: string;
}