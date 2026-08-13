import { IsUUID } from 'class-validator';

export class GetUserAddressParamDto {
  @IsUUID()
  userId!: string;
}
