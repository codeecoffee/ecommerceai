import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { DatabaseService } from '../../database/providers/database.service';
import { ProductService } from '../../product/provider/product.service';
import type { OrderPaymentHook } from '../interface/order-payment-hook.interface';
import { ORDER_PAYMENT_HOOK } from '../interface/order-payment-hook.interface';
import {
  OrderStatus,
  Prisma,
} from '../../../prisma/src/generated/prisma/client';
import { OrderResponseDto } from '../dto/response-order.dto';
import { OrderMapper, OrderWithItems } from '../mapper/order.mapper';
import { OrderQueryDto } from '../dto/get-orders-query.dto';
import { PaginatedResponseDto } from '../../common/dto/response-paginated.dto';
import { CartService } from '../../cart/provider/cart.service';

const ORDER_STATE_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
  [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [OrderStatus.REFUNDED],
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.REFUNDED]: [],
};

// Statuses in which stock has been reserved (decremented at checkout) and
// therefore must be released back via adjustStock() on cancellation.
const STOCK_RESERVED_STATUSES: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
  OrderStatus.PROCESSING,
];

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: DatabaseService,
    private readonly productService: ProductService,
    private readonly cartService: CartService,
    @Optional()
    @Inject(ORDER_PAYMENT_HOOK)
    private readonly paymentHook?: OrderPaymentHook,
  ) {}

  /**
   * Checkout: converts the user's ACTIVE cart into an Order.
   *
   * Everything below runs inside one prisma.$transaction — inventory
   * decrement, order + order-item creation, and (when registered) the
   * payment hook — per BR-ORDER-05 and NFR "narrow transactions" guidance.
   */
  async checkout(userId: string): Promise<OrderResponseDto> {
    const order = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new NotFoundException('User not found');
      }
      if (!user.address_id) {
        throw new BadRequestException(
          'Add an address to your account before checking out',
        );
      }

      const cart = await this.cartService.findActiveCartWithItems(userId, tx);
      if (!cart || cart.cart_items.length === 0) {
        throw new BadRequestException('Cart is empty');
      }

      let total = 0;
      const itemInputs: {
        prod_id: string;
        quantity: number;
        price_at_purchase: number;
      }[] = [];

      for (const cartItem of cart.cart_items) {
        // adjustStock() is the actual concurrency guard here (atomic
        // conditional updateMany) — it throws if there isn't enough stock.
        await this.productService.adjustStock(
          cartItem.prod_id,
          -cartItem.quantity,
          tx,
        );

        // Snapshot the CURRENT price at checkout (BR-ORDER-02) — not
        // cart_item.price_at_add, which is only for cart-display stability.
        const product = await tx.product.findUniqueOrThrow({
          where: { prod_id: cartItem.prod_id },
        });
        const price = Number(product.price);
        total += price * cartItem.quantity;
        itemInputs.push({
          prod_id: cartItem.prod_id,
          quantity: cartItem.quantity,
          price_at_purchase: price,
        });
      }

      const createdOrder = await tx.order.create({
        data: {
          user_id: userId,
          address_id: user.address_id,
          status: OrderStatus.PENDING,
          total,
          order_items: { create: itemInputs },
        },
        include: { order_items: true },
      });

      // BR-REC-01: PurchaseHistory is created as a side effect of order
      // completion. Treating "completion" as successful checkout (not
      // DELIVERED) — flag this if you'd rather it fire later, e.g. move
      // this block into deliver() instead.
      await tx.purchase_history.createMany({
        data: itemInputs.map((item) => ({
          user_id: userId,
          prod_id: item.prod_id,
          order_id: createdOrder.order_id,
          quantity: item.quantity,
          price_paid: item.price_at_purchase,
        })),
      });

      // Cart owns writes to its own status field — same rationale as
      // ProductService.adjustStock() above.
      await this.cartService.markConverted(cart.cart_id, tx);

      // Extensibility point for the not-yet-built Payment module. No-op
      // today since nothing provides ORDER_PAYMENT_HOOK.
      if (this.paymentHook) {
        await this.paymentHook.createPaymentForOrder(
          { orderId: createdOrder.order_id, amount: total },
          tx,
        );
      }

      return createdOrder;
    });

    // Deliberately OUTSIDE the $transaction above. Any external gateway
    // call must never hold a DB transaction/row-lock open for its
    // duration (NFR, project_specs.md section 10) — this is why the
    // interface splits payment creation (a pure DB write, safe inside the
    // transaction) from this step (an external call, safe only outside it).
    //
    // Errors here are caught, not rethrown: the order and its PENDING
    // payment row already committed successfully, so the checkout request
    // itself still succeeds even if the gateway step fails. The Payment
    // row is left however the hook's own implementation leaves it
    // (typically still PENDING) for a later retry.
    if (this.paymentHook?.afterCheckoutCommitted) {
      try {
        await this.paymentHook.afterCheckoutCommitted(order.order_id);
      } catch (err) {
        // TODO: replace with your actual logger.
        console.error(
          `Payment gateway step failed for order ${order.order_id}`,
          err,
        );
      }
    }

    return OrderMapper.toResponseDto(order);
  }
  async findOne(orderId: string): Promise<OrderResponseDto> {
    const order = await this.prisma.order.findUnique({
      where: { order_id: orderId },
      include: { order_items: true },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return OrderMapper.toResponseDto(order);
  }

  async findAllForUser(
    userId: string,
    query: OrderQueryDto,
  ): Promise<PaginatedResponseDto<OrderResponseDto>> {
    return this.paginate({ user_id: userId, status: query.status }, query);
  }

  /** Backs GET /orders/admin — RolesGuard(ADMIN)-gated in the controller. */
  async findAllAdmin(
    query: OrderQueryDto,
  ): Promise<PaginatedResponseDto<OrderResponseDto>> {
    return this.paginate(
      { status: query.status, user_id: query.userId },
      query,
    );
  }

  private async paginate(
    where: Prisma.OrderWhereInput,
    query: OrderQueryDto,
  ): Promise<PaginatedResponseDto<OrderResponseDto>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: { order_items: true },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: rows.map((row) => OrderMapper.toResponseDto(row)),
      metadata: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  // --- Named state-transition actions (BR-ORDER-03) ---
  // Orders are never PATCHed generically; each of these enforces the
  // transition table above and, for cancellation, releases reserved stock.

  confirm(orderId: string) {
    return this.transition(orderId, OrderStatus.CONFIRMED);
  }

  process(orderId: string) {
    return this.transition(orderId, OrderStatus.PROCESSING);
  }

  ship(orderId: string) {
    return this.transition(orderId, OrderStatus.SHIPPED);
  }

  deliver(orderId: string) {
    return this.transition(orderId, OrderStatus.DELIVERED);
  }

  cancel(orderId: string) {
    return this.transition(orderId, OrderStatus.CANCELLED);
  }

  refund(orderId: string) {
    return this.transition(orderId, OrderStatus.REFUNDED);
  }

  private async transition(
    orderId: string,
    target: OrderStatus,
  ): Promise<OrderResponseDto> {
    const order = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.order.findUnique({
        where: { order_id: orderId },
        include: { order_items: true },
      });
      if (!existing) {
        throw new NotFoundException('Order not found');
      }

      const allowed = ORDER_STATE_TRANSITIONS[existing.status];
      if (!allowed.includes(target)) {
        throw new ConflictException(
          `Cannot move order from ${existing.status} to ${target}`,
        );
      }

      if (
        target === OrderStatus.CANCELLED &&
        STOCK_RESERVED_STATUSES.includes(existing.status)
      ) {
        for (const item of existing.order_items) {
          // release reserved stock — positive delta
          await this.productService.adjustStock(
            item.prod_id,
            item.quantity,
            tx,
          );
        }
      }

      return tx.order.update({
        where: { order_id: orderId },
        data: { status: target },
        include: { order_items: true },
      });
    });

    return OrderMapper.toResponseDto(order);
  }
}
