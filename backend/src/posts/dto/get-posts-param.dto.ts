import { Type } from "class-transformer";
import { IsInt, IsOptional } from "class-validator";

export class GetPostsParamDto{

    @IsOptional()
    @IsInt()
    @Type(() => Number)
    authorId?: number;
}