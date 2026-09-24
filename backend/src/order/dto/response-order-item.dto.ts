import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, IsUUID } from 'class-validator';

export class OrderItemResponseDto {
  @ApiProperty({ description: 'UUID', example: 'order_id' })
  @IsUUID()
  orderItemId: string;

  @ApiProperty()
  @IsString()
  productId: string;
  @ApiProperty({ description: 'Product quantity', example: '3' })
  @IsInt()
  quantity: number;
  @ApiProperty()
  @IsInt()
  priceAtPurchase: number;
  @ApiProperty({
    description:
      'Price at Purchase * Quantity; computed for display convenience',
    example: '15.00',
  })
  @IsInt()
  lineTotal: number;
}
