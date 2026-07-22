import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GetUsersParamDto {
  @ApiProperty({
    description: 'Get user with a specific UUID',
    example: '7aa02917-e3b5-4e83-9849-352f0c8dff2e',
  })
  @IsUUID()
  id!: string;
}
