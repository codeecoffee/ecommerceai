import { CartItemResponseDto } from '../dto/response-cartItem.dto';
import type { Cart_item } from '../../../prisma/src/generated/prisma/client';

export class CartItemMapper {
  static toResponseDto(item: Cart_item): CartItemResponseDto {
    const price = Number(item.price_at_add);
    return {
      cartItemId: item.cart_item_id,
      productId: item.prod_id,
      quantity: item.quantity,
      priceAtAdd: price,
      lineTotal: Number((price * item.quantity).toFixed(2)),
    };
  }
}
