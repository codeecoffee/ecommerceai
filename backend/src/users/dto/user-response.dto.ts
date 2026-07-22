import { Exclude, Expose } from 'class-transformer'

export class UserResponseDto{
    @Expose()
    id!: string;
    
    @Expose()
    first_name!: string;
    
    @Expose()
    last_name!: string;
    
    @Expose()
    email!: string;
    
    @Expose()
    photo_url!: string;
    
    @Expose()
    address_id!: string;
    
    @Expose()
    role!: string;

    @Expose()
    createdAt!: Date;

    @Expose()
    updatedAt!: Date;

    @Exclude()
    password_hash!: string;
}