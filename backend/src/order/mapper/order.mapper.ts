import { OrderResponseDto } from '../dto/response-order.dto';
import { OrderItemMapper } from './order-item.mapper';
import type { Order, Order_item } from '../../generated/prisma/client';

export type OrderWithItems = Order & { order_items: Order_item[] };

export class OrderMapper {
  static toResponseDto(order: OrderWithItems): OrderResponseDto {
    return {
      orderId: order.order_id,
      userId: order.user_id,
      addressId: order.address_id,
      status: order.status,
      total: Number(order.total),
      items: order.order_items.map((item) =>
        OrderItemMapper.toResponseDto(item),
      ),
      createdAt: order.created_at,
      updatedAt: order.updated_at,
    };
  }
}
