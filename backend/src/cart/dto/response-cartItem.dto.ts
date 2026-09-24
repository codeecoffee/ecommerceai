import { ApiProperty } from '@nestjs/swagger';

export class CartItemResponseDto {
  @ApiProperty()
  cartItemId: string;

  @ApiProperty()
  productId: string;

  @ApiProperty()
  quantity: number;

  @ApiProperty({
    description:
      'Price captured when this line was added / last incremented. Display-only — checkout always snapshots the current Product price regardless (BR-ORDER-02), so this can go stale without affecting what gets charged.',
  })
  priceAtAdd: number;

  @ApiProperty({
    description: 'priceAtAdd * quantity, for display convenience.',
  })
  lineTotal: number;
}
