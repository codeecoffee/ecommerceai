import { Exclude } from 'class-transformer'

export class UserResponseDto{
    id!: string;
    first_name!: string;
    last_name!: string;
    email!: string;
    photo_url!: string;
    address_id!: string;
    role!: string;

    @Exclude()
    password_hash!: string;
}