import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CartService } from './cart.service';

function createPrismaMock() {
  const tx = {
    product: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn() },
    cart: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    cart_item: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  const prisma = {
    $transaction: jest.fn(async (fn: any) => fn(tx)),
    cart: tx.cart,
    cart_item: tx.cart_item,
  };

  return { prisma, tx };
}

describe('CartService', () => {
  describe('getCart', () => {
    it('returns the empty shape when the user has no ACTIVE cart', async () => {
      const { prisma } = createPrismaMock();
      (prisma as any).cart.findFirst = jest.fn().mockResolvedValue(null);
      const service = new CartService(prisma as any);

      const result = await service.getCart('u1');
      expect(result).toEqual({
        cartId: null,
        status: null,
        items: [],
        total: 0,
      });
    });
  });

  describe('addItem', () => {
    it('creates a cart lazily and adds a new line item', async () => {
      const { prisma, tx } = createPrismaMock();
      tx.product.findUnique.mockResolvedValue({
        prod_id: 'p1',
        price: 10,
        stock_qty: 5,
        is_active: true,
      });
      tx.cart.findFirst.mockResolvedValue(null); // no ACTIVE cart yet
      tx.cart.create.mockResolvedValue({
        cart_id: 'c1',
        user_id: 'u1',
        status: 'ACTIVE',
      });
      tx.cart_item.findFirst.mockResolvedValue(null); // not already in cart
      tx.cart.findUniqueOrThrow.mockResolvedValue({
        cart_id: 'c1',
        status: 'ACTIVE',
        cart_items: [
          { cart_item_id: 'ci1', prod_id: 'p1', quantity: 2, price_at_add: 10 },
        ],
      });

      const service = new CartService(prisma as any);
      const result = await service.addItem('u1', {
        productId: 'p1',
        quantity: 2,
      });

      expect(tx.cart.create).toHaveBeenCalledWith({
        data: { user_id: 'u1', status: 'ACTIVE' },
      });
      expect(tx.cart_item.create).toHaveBeenCalledWith({
        data: { cart_id: 'c1', prod_id: 'p1', quantity: 2, price_at_add: 10 },
      });
      expect(result.cartId).toBe('c1');
      expect(result.total).toBe(20);
    });

    it('increments quantity and refreshes price_at_add when the product is already in the cart', async () => {
      const { prisma, tx } = createPrismaMock();
      tx.product.findUnique.mockResolvedValue({
        prod_id: 'p1',
        price: 12, // price changed since it was first added
        stock_qty: 10,
        is_active: true,
      });
      tx.cart.findFirst.mockResolvedValue({
        cart_id: 'c1',
        user_id: 'u1',
        status: 'ACTIVE',
      });
      tx.cart_item.findFirst.mockResolvedValue({
        cart_item_id: 'ci1',
        cart_id: 'c1',
        prod_id: 'p1',
        quantity: 1,
        price_at_add: 10,
      });
      tx.cart.findUniqueOrThrow.mockResolvedValue({
        cart_id: 'c1',
        status: 'ACTIVE',
        cart_items: [
          { cart_item_id: 'ci1', prod_id: 'p1', quantity: 3, price_at_add: 12 },
        ],
      });

      const service = new CartService(prisma as any);
      await service.addItem('u1', { productId: 'p1', quantity: 2 });

      expect(tx.cart_item.create).not.toHaveBeenCalled();
      expect(tx.cart_item.update).toHaveBeenCalledWith({
        where: { cart_item_id: 'ci1' },
        data: { quantity: 3, price_at_add: 12 },
      });
    });

    it('throws BadRequestException when the requested quantity exceeds stock (soft check)', async () => {
      const { prisma, tx } = createPrismaMock();
      tx.product.findUnique.mockResolvedValue({
        prod_id: 'p1',
        price: 10,
        stock_qty: 3,
        is_active: true,
      });
      tx.cart.findFirst.mockResolvedValue(null);
      tx.cart.create.mockResolvedValue({
        cart_id: 'c1',
        user_id: 'u1',
        status: 'ACTIVE',
      });
      tx.cart_item.findFirst.mockResolvedValue(null);

      const service = new CartService(prisma as any);
      await expect(
        service.addItem('u1', { productId: 'p1', quantity: 5 }),
      ).rejects.toThrow(BadRequestException);
      expect(tx.cart_item.create).not.toHaveBeenCalled();
    });

    it('accounts for existing quantity when checking stock on increment', async () => {
      const { prisma, tx } = createPrismaMock();
      tx.product.findUnique.mockResolvedValue({
        prod_id: 'p1',
        price: 10,
        stock_qty: 4,
        is_active: true,
      });
      tx.cart.findFirst.mockResolvedValue({
        cart_id: 'c1',
        user_id: 'u1',
        status: 'ACTIVE',
      });
      tx.cart_item.findFirst.mockResolvedValue({
        cart_item_id: 'ci1',
        cart_id: 'c1',
        prod_id: 'p1',
        quantity: 3,
        price_at_add: 10,
      });

      const service = new CartService(prisma as any);
      // existing 3 + requested 2 = 5 > stock_qty 4
      await expect(
        service.addItem('u1', { productId: 'p1', quantity: 2 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException for a missing or inactive product', async () => {
      const { prisma, tx } = createPrismaMock();
      tx.product.findUnique.mockResolvedValue(null);

      const service = new CartService(prisma as any);
      await expect(
        service.addItem('u1', { productId: 'missing', quantity: 1 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateItemQuantity', () => {
    it('throws ForbiddenException when the cart item belongs to another user', async () => {
      const { prisma, tx } = createPrismaMock();
      tx.cart_item.findUnique.mockResolvedValue({
        cart_item_id: 'ci1',
        prod_id: 'p1',
        cart_id: 'c1',
        cart: { user_id: 'someone-else' },
      });

      const service = new CartService(prisma as any);
      await expect(
        service.updateItemQuantity('u1', 'ci1', { quantity: 2 }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when the cart item does not exist', async () => {
      const { prisma, tx } = createPrismaMock();
      tx.cart_item.findUnique.mockResolvedValue(null);

      const service = new CartService(prisma as any);
      await expect(
        service.updateItemQuantity('u1', 'missing', { quantity: 2 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('updates quantity without touching price_at_add', async () => {
      const { prisma, tx } = createPrismaMock();
      tx.cart_item.findUnique.mockResolvedValue({
        cart_item_id: 'ci1',
        prod_id: 'p1',
        cart_id: 'c1',
        cart: { user_id: 'u1' },
      });
      tx.product.findUniqueOrThrow.mockResolvedValue({
        prod_id: 'p1',
        stock_qty: 10,
        price: 10,
      });
      tx.cart.findUniqueOrThrow.mockResolvedValue({
        cart_id: 'c1',
        status: 'ACTIVE',
        cart_items: [
          { cart_item_id: 'ci1', prod_id: 'p1', quantity: 5, price_at_add: 10 },
        ],
      });

      const service = new CartService(prisma as any);
      await service.updateItemQuantity('u1', 'ci1', { quantity: 5 });

      expect(tx.cart_item.update).toHaveBeenCalledWith({
        where: { cart_item_id: 'ci1' },
        data: { quantity: 5 },
      });
    });

    it('throws BadRequestException when the new quantity exceeds stock', async () => {
      const { prisma, tx } = createPrismaMock();
      tx.cart_item.findUnique.mockResolvedValue({
        cart_item_id: 'ci1',
        prod_id: 'p1',
        cart_id: 'c1',
        cart: { user_id: 'u1' },
      });
      tx.product.findUniqueOrThrow.mockResolvedValue({
        prod_id: 'p1',
        stock_qty: 2,
        price: 10,
      });

      const service = new CartService(prisma as any);
      await expect(
        service.updateItemQuantity('u1', 'ci1', { quantity: 99 }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('removeItem', () => {
    it('deletes the item after confirming ownership', async () => {
      const { prisma, tx } = createPrismaMock();
      tx.cart_item.findUnique.mockResolvedValue({
        cart_item_id: 'ci1',
        prod_id: 'p1',
        cart_id: 'c1',
        cart: { user_id: 'u1' },
      });
      tx.cart.findUniqueOrThrow.mockResolvedValue({
        cart_id: 'c1',
        status: 'ACTIVE',
        cart_items: [],
      });

      const service = new CartService(prisma as any);
      const result = await service.removeItem('u1', 'ci1');

      expect(tx.cart_item.delete).toHaveBeenCalledWith({
        where: { cart_item_id: 'ci1' },
      });
      expect(result.items).toHaveLength(0);
    });

    it("throws ForbiddenException for someone else's cart item", async () => {
      const { prisma, tx } = createPrismaMock();
      tx.cart_item.findUnique.mockResolvedValue({
        cart_item_id: 'ci1',
        cart: { user_id: 'someone-else' },
      });

      const service = new CartService(prisma as any);
      await expect(service.removeItem('u1', 'ci1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(tx.cart_item.delete).not.toHaveBeenCalled();
    });
  });

  describe('clearCart', () => {
    it('returns { deleted: false } when there is no ACTIVE cart', async () => {
      const { prisma } = createPrismaMock();
      (prisma as any).cart.findFirst = jest.fn().mockResolvedValue(null);

      const service = new CartService(prisma as any);
      const result = await service.clearCart('u1');
      expect(result).toEqual({ deleted: false });
    });

    it('deletes all items and returns { deleted: true } when a cart exists', async () => {
      const { prisma } = createPrismaMock();
      (prisma as any).cart.findFirst = jest
        .fn()
        .mockResolvedValue({ cart_id: 'c1' });
      (prisma as any).cart_item.deleteMany = jest
        .fn()
        .mockResolvedValue({ count: 3 });

      const service = new CartService(prisma as any);
      const result = await service.clearCart('u1');

      expect((prisma as any).cart_item.deleteMany).toHaveBeenCalledWith({
        where: { cart_id: 'c1' },
      });
      expect(result).toEqual({ deleted: true });
    });
  });
});
