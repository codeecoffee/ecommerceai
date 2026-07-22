import { IsInt, IsNotEmpty, IsString, IsUUID, Max, MaxLength, Min, MinLength } from "class-validator";

export class CreatePostDto{

    //!TODO: This should come from the JWT token
    // once the user is auth, they will only be able to create posts with them being
    //the author
    @IsUUID()
    @IsNotEmpty()
    authorId!: string;

    @IsInt()
    @IsNotEmpty()
    @Min(1)
    @Max(5)
    rating!: number;

    @IsString()
    @IsNotEmpty()
    @MinLength(5)
    @MaxLength(30)
    title!: string;

    @IsString()
    @IsNotEmpty()
    @MinLength(5)
    @MaxLength(250)
    comment?: string;


    @IsUUID()
    @IsNotEmpty()
    productId!: string;
}