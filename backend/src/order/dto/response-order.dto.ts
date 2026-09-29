import { ApiProperty } from '@nestjs/swagger';
import { OrderItemResponseDto } from './response-order-item.dto';
// Adjust this import to match wherever your generated Prisma client actually resolves.
import { OrderStatus } from '../../generated/prisma/client';

export class OrderResponseDto {
  @ApiProperty()
  orderId: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  addressId: string;

  @ApiProperty({ enum: OrderStatus })
  status: OrderStatus;

  @ApiProperty()
  total: number;

  @ApiProperty({ type: [OrderItemResponseDto] })
  items: OrderItemResponseDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
