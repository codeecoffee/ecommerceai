import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderStatus } from '../../generated/prisma/client';
import { CartService } from '../../cart/provider/cart.service';

/**
 * Builds a fake `tx` object with just the model methods checkout()/transition()
 * touch, and wires prisma.$transaction to invoke the callback with it —
 * mirroring the real prisma.$transaction(async (tx) => ...) signature.
 */
function createPrismaMock(overrides: Record<string, any> = {}) {
  const tx = {
    user: { findUnique: jest.fn() },
    product: { findUniqueOrThrow: jest.fn() },
    order: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    purchase_history: { createMany: jest.fn() },
    ...overrides,
  };

  const prisma = {
    $transaction: jest.fn(async (arg: any) => {
      if (Array.isArray(arg)) {
        return Promise.all(arg);
      }
      return arg(tx);
    }),
    order: tx.order,
  };

  return { prisma, tx };
}

function createCartServiceMock() {
  return {
    findActiveCartWithItems: jest.fn(),
    markConverted: jest.fn(),
  } as unknown as CartService;
}

describe('OrderService', () => {
  describe('checkout', () => {
    it('decrements stock, snapshots current price, creates the order, purchase history, and converts the cart via CartService', async () => {
      const { prisma, tx } = createPrismaMock();
      const productService = { adjustStock: jest.fn() } as any;
      const cartService = createCartServiceMock();

      tx.user.findUnique.mockResolvedValue({ id: 'u1', address_id: 'addr1' });
      (cartService.findActiveCartWithItems as jest.Mock).mockResolvedValue({
        cart_id: 'cart1',
        cart_items: [{ prod_id: 'p1', quantity: 2, price_at_add: 5 }],
      });
      // price_at_purchase must come from the CURRENT product price (10),
      // not cart_item.price_at_add (5).
      tx.product.findUniqueOrThrow.mockResolvedValue({
        prod_id: 'p1',
        price: 10,
      });
      tx.order.create.mockResolvedValue({
        order_id: 'order1',
        user_id: 'u1',
        address_id: 'addr1',
        status: OrderStatus.PENDING,
        total: 20,
        order_items: [
          {
            order_item_id: 'oi1',
            prod_id: 'p1',
            quantity: 2,
            price_at_purchase: 10,
          },
        ],
        created_at: new Date(),
        updated_at: new Date(),
      });

      const service = new OrderService(
        prisma as any,
        productService,
        cartService,
        undefined,
      );
      const result = await service.checkout('u1');

      expect(cartService.findActiveCartWithItems).toHaveBeenCalledWith(
        'u1',
        tx,
      );
      expect(productService.adjustStock).toHaveBeenCalledWith('p1', -2, tx);
      expect(tx.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            user_id: 'u1',
            address_id: 'addr1',
            status: OrderStatus.PENDING,
            total: 20,
          }),
        }),
      );
      expect(tx.purchase_history.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            user_id: 'u1',
            prod_id: 'p1',
            order_id: 'order1',
            quantity: 2,
            price_paid: 10,
          }),
        ],
      });
      // Cart's own status write now goes through CartService, not tx.cart.update.
      expect(cartService.markConverted).toHaveBeenCalledWith('cart1', tx);
      expect(result.orderId).toBe('order1');
      expect(result.total).toBe(20);
      expect(result.items[0].priceAtPurchase).toBe(10);
    });

    it('throws BadRequestException when the user has no address', async () => {
      const { prisma, tx } = createPrismaMock();
      const cartService = createCartServiceMock();
      tx.user.findUnique.mockResolvedValue({ id: 'u1', address_id: null });
      const service = new OrderService(
        prisma as any,
        {} as any,
        cartService,
        undefined,
      );

      await expect(service.checkout('u1')).rejects.toThrow(BadRequestException);
      expect(cartService.findActiveCartWithItems).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when the cart is empty or missing', async () => {
      const { prisma, tx } = createPrismaMock();
      const cartService = createCartServiceMock();
      tx.user.findUnique.mockResolvedValue({ id: 'u1', address_id: 'addr1' });
      (cartService.findActiveCartWithItems as jest.Mock).mockResolvedValue(
        null,
      );
      const service = new OrderService(
        prisma as any,
        {} as any,
        cartService,
        undefined,
      );

      await expect(service.checkout('u1')).rejects.toThrow(BadRequestException);
    });

    it('propagates adjustStock failures (e.g. insufficient stock) without creating the order or converting the cart', async () => {
      const { prisma, tx } = createPrismaMock();
      const cartService = createCartServiceMock();
      tx.user.findUnique.mockResolvedValue({ id: 'u1', address_id: 'addr1' });
      (cartService.findActiveCartWithItems as jest.Mock).mockResolvedValue({
        cart_id: 'cart1',
        cart_items: [{ prod_id: 'p1', quantity: 99, price_at_add: 5 }],
      });
      const productService = {
        adjustStock: jest
          .fn()
          .mockRejectedValue(new ConflictException('insufficient stock')),
      } as any;

      const service = new OrderService(
        prisma as any,
        productService,
        cartService,
        undefined,
      );
      await expect(service.checkout('u1')).rejects.toThrow(ConflictException);
      expect(tx.order.create).not.toHaveBeenCalled();
      expect(cartService.markConverted).not.toHaveBeenCalled();
    });

    it('invokes the payment hook when one is registered, inside the same transaction', async () => {
      const { prisma, tx } = createPrismaMock();
      const productService = { adjustStock: jest.fn() } as any;
      const cartService = createCartServiceMock();
      tx.user.findUnique.mockResolvedValue({ id: 'u1', address_id: 'addr1' });
      (cartService.findActiveCartWithItems as jest.Mock).mockResolvedValue({
        cart_id: 'cart1',
        cart_items: [{ prod_id: 'p1', quantity: 1, price_at_add: 5 }],
      });
      tx.product.findUniqueOrThrow.mockResolvedValue({
        prod_id: 'p1',
        price: 10,
      });
      tx.order.create.mockResolvedValue({
        order_id: 'order1',
        order_items: [],
        status: OrderStatus.PENDING,
        total: 10,
        user_id: 'u1',
        address_id: 'addr1',
        created_at: new Date(),
        updated_at: new Date(),
      });

      const paymentHook = { createPaymentForOrder: jest.fn() };
      const service = new OrderService(
        prisma as any,
        productService,
        cartService,
        paymentHook,
      );
      await service.checkout('u1');

      expect(paymentHook.createPaymentForOrder).toHaveBeenCalledWith(
        { orderId: 'order1', amount: 10 },
        tx,
      );
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when the order does not exist', async () => {
      const { prisma } = createPrismaMock();
      (prisma as any).order.findUnique = jest.fn().mockResolvedValue(null);
      const service = new OrderService(
        prisma as any,
        {} as any,
        createCartServiceMock(),
        undefined,
      );

      await expect(service.findOne('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('state transitions', () => {
    it('allows PENDING -> CONFIRMED', async () => {
      const { prisma, tx } = createPrismaMock();
      tx.order.findUnique.mockResolvedValue({
        order_id: 'o1',
        status: OrderStatus.PENDING,
        order_items: [],
      });
      tx.order.update.mockResolvedValue({
        order_id: 'o1',
        status: OrderStatus.CONFIRMED,
        order_items: [],
        user_id: 'u1',
        address_id: 'a1',
        total: 10,
        created_at: new Date(),
        updated_at: new Date(),
      });
      const service = new OrderService(
        prisma as any,
        {} as any,
        createCartServiceMock(),
        undefined,
      );

      const result = await service.confirm('o1');
      expect(result.status).toBe(OrderStatus.CONFIRMED);
    });

    it('rejects an invalid transition (DELIVERED -> CANCELLED) with ConflictException', async () => {
      const { prisma, tx } = createPrismaMock();
      tx.order.findUnique.mockResolvedValue({
        order_id: 'o1',
        status: OrderStatus.DELIVERED,
        order_items: [],
      });
      const service = new OrderService(
        prisma as any,
        {} as any,
        createCartServiceMock(),
        undefined,
      );

      await expect(service.cancel('o1')).rejects.toThrow(ConflictException);
      expect(tx.order.update).not.toHaveBeenCalled();
    });

    it('releases reserved stock when cancelling a PENDING order', async () => {
      const { prisma, tx } = createPrismaMock();
      const productService = { adjustStock: jest.fn() } as any;
      tx.order.findUnique.mockResolvedValue({
        order_id: 'o1',
        status: OrderStatus.PENDING,
        order_items: [{ prod_id: 'p1', quantity: 3 }],
      });
      tx.order.update.mockResolvedValue({
        order_id: 'o1',
        status: OrderStatus.CANCELLED,
        order_items: [{ prod_id: 'p1', quantity: 3 }],
        user_id: 'u1',
        address_id: 'a1',
        total: 10,
        created_at: new Date(),
        updated_at: new Date(),
      });
      const service = new OrderService(
        prisma as any,
        productService,
        createCartServiceMock(),
        undefined,
      );

      await service.cancel('o1');
      expect(productService.adjustStock).toHaveBeenCalledWith('p1', 3, tx);
    });

    it('does NOT release stock when cancelling from a state where none was reserved (defensive — should never occur given the transition table)', async () => {
      const { prisma, tx } = createPrismaMock();
      const productService = { adjustStock: jest.fn() } as any;
      tx.order.findUnique.mockResolvedValue({
        order_id: 'o1',
        status: OrderStatus.SHIPPED,
        order_items: [{ prod_id: 'p1', quantity: 3 }],
      });
      const service = new OrderService(
        prisma as any,
        productService,
        createCartServiceMock(),
        undefined,
      );

      await expect(service.cancel('o1')).rejects.toThrow(ConflictException);
      expect(productService.adjustStock).not.toHaveBeenCalled();
    });
  });
});
