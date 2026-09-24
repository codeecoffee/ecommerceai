import { Cart, Cart_item } from '../../../prisma/src/generated/prisma/client';
import { CartResponseDto } from '../dto/response-cart.dto';
import { CartItemMapper } from './cartItem.mapper';

export type CartWithItems = Cart & { cart_items: Cart_item[] };

export class CartMapper {
  static toResponseDto(cart: CartWithItems | null): CartResponseDto {
    if (!cart) {
      return { cartId: null, status: null, items: [], total: 0 };
    }
    const items = cart.cart_items.map((cart) =>
      CartItemMapper.toResponseDto(cart),
    );
    const total = Number(
      items.reduce((sum, item) => sum + item.lineTotal, 0).toFixed(2),
    );

    return {
      cartId: cart.cart_id,
      status: cart.status,
      items,
      total,
    };
  }
}
