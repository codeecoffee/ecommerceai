import { Expose } from 'class-transformer';
import { ResponseAddressDto } from './response-address.dto';

export class ResponseFullAddressDto extends ResponseAddressDto {
  @Expose()
  orders!: string[];
  @Expose()
  users!: string[];
}
