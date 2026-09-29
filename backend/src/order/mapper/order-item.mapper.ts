import { OrderItemResponseDto } from '../dto/response-order-item.dto';
import type { Order_item } from '../../generated/prisma/client';

export class OrderItemMapper {
  static toResponseDto(item: Order_item): OrderItemResponseDto {
    const price = Number(item.price_at_purchase);
    return {
      orderItemId: item.order_item_id,
      productId: item.prod_id,
      quantity: item.quantity,
      priceAtPurchase: price,
      lineTotal: Number((price * item.quantity).toFixed(2)),
    };
  }
}
