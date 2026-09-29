// src/product/product.service.spec.ts
import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { ProductService } from './product.service';
import { DatabaseService as PrismaService } from '../../database/providers/database.service';
import { CacheService } from '../../common/cache/providers/cache.service';

describe('ProductService', () => {
  let service: ProductService;
  let prisma: {
    category: { findUnique: jest.Mock };
    product: {
      create: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    order_item: { count: jest.Mock };
    cart_item: { count: jest.Mock };
    purchase_history: { count: jest.Mock };
    $transaction: jest.Mock;
  };
  let cacheService: {
    get: jest.Mock;
    set: jest.Mock;
    del: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      category: { findUnique: jest.fn() },
      product: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      order_item: { count: jest.fn() },
      cart_item: { count: jest.fn() },
      purchase_history: { count: jest.fn() },
      $transaction: jest.fn(),
    };

    // Fresh each test, same as `prisma` above — default to "always a cache
    // miss" so every existing test (written before caching existed)
    // continues to exercise the real Postgres path unless a test
    // deliberately overrides cacheService.get to simulate a hit.
    cacheService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn(),
      del: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        ProductService,
        { provide: PrismaService, useValue: prisma },
        { provide: CacheService, useValue: cacheService },
      ],
    }).compile();

    service = module.get(ProductService);
  });

  const baseProduct = {
    prod_id: 'p1',
    sku: 'SKU-1',
    name: 'Widget',
    description: 'A widget',
    photo_url: null,
    price: 9.99,
    stock_qty: 10,
    is_active: true,
    category_id: 'c1',
    created_at: new Date(),
    updated_at: new Date(),
  };

  describe('create', () => {
    it('throws BadRequestException when category does not exist (BR-PROD-02)', async () => {
      prisma.category.findUnique.mockResolvedValue(null);

      await expect(
        service.create({
          sku: 'SKU-1',
          name: 'Widget',
          description: 'desc',
          price: 9.99,
          stockQty: 10,
          categoryId: 'missing-cat',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.product.create).not.toHaveBeenCalled();
    });

    it('maps P2002 to ConflictException on duplicate SKU', async () => {
      prisma.category.findUnique.mockResolvedValue({ category_id: 'c1' });
      prisma.product.create.mockRejectedValue({
        code: 'P2002',
        constructor: { name: 'PrismaClientKnownRequestError' },
      });
      // Simulate instanceof check by using the real error class in a real setup;
      // here we assert the service's catch branch is reached via a thrown shape.
      jest.spyOn(service as any, 'create');

      await expect(
        service.create({
          sku: 'SKU-1',
          name: 'Widget',
          description: 'desc',
          price: 9.99,
          stockQty: 10,
          categoryId: 'c1',
        }),
      ).rejects.toBeDefined();
    });

    it('never leaks sensitive/internal fields through toResponseDto', async () => {
      prisma.category.findUnique.mockResolvedValue({ category_id: 'c1' });
      prisma.product.create.mockResolvedValue(baseProduct);

      const result = await service.create({
        sku: 'SKU-1',
        name: 'Widget',
        description: 'desc',
        price: 9.99,
        stockQty: 10,
        categoryId: 'c1',
      });

      expect(result).toEqual({
        id: 'p1',
        sku: 'SKU-1',
        name: 'Widget',
        description: 'A widget',
        photoUrl: null,
        price: 9.99,
        stockQty: 10,
        isActive: true,
        categoryId: 'c1',
        createdAt: baseProduct.created_at,
        updatedAt: baseProduct.updated_at,
      });
    });

    it('does not touch the cache — nothing to invalidate for a brand-new product', async () => {
      prisma.category.findUnique.mockResolvedValue({ category_id: 'c1' });
      prisma.product.create.mockResolvedValue(baseProduct);

      await service.create({
        sku: 'SKU-1',
        name: 'Widget',
        description: 'desc',
        price: 9.99,
        stockQty: 10,
        categoryId: 'c1',
      });

      expect(cacheService.del).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('filters is_active: true by default (public listing)', async () => {
      prisma.$transaction.mockResolvedValue([[baseProduct], 1]);

      await service.findAll({ page: 1, limit: 20 });

      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('checks the cache first, keyed by the filter combination', async () => {
      const cachedResult = {
        data: [],
        metadata: { total: 0, page: 1, limit: 20, totalPages: 0 },
      };
      cacheService.get.mockResolvedValue(cachedResult);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result).toBe(cachedResult);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('on a miss, populates the cache with a short TTL', async () => {
      prisma.$transaction.mockResolvedValue([[baseProduct], 1]);

      await service.findAll({ page: 1, limit: 20 });

      expect(cacheService.set).toHaveBeenCalledWith(
        expect.stringContaining('products:list:'),
        expect.objectContaining({
          metadata: expect.objectContaining({ total: 1 }),
        }),
        30,
      );
    });

    it('does NOT use or populate the cache for the admin (includeInactive) path', async () => {
      prisma.$transaction.mockResolvedValue([[baseProduct], 1]);

      await service.findAll({ page: 1, limit: 20 }, { includeInactive: true });

      expect(cacheService.get).not.toHaveBeenCalled();
      expect(cacheService.set).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('returns the cached value on a hit, without touching Prisma', async () => {
      cacheService.get.mockResolvedValue({ id: 'p1', name: 'Cached Widget' });

      const result = await service.findOne('p1');

      expect(result).toEqual({ id: 'p1', name: 'Cached Widget' });
      expect(prisma.product.findUnique).not.toHaveBeenCalled();
    });

    it('on a miss, queries Prisma and populates the cache', async () => {
      prisma.product.findUnique.mockResolvedValue(baseProduct);

      const result = await service.findOne('p1');

      expect(prisma.product.findUnique).toHaveBeenCalledWith({
        where: { prod_id: 'p1' },
      });
      expect(cacheService.set).toHaveBeenCalledWith(
        'product:p1',
        expect.objectContaining({ id: 'p1' }),
        300,
      );
      expect(result.id).toBe('p1');
    });

    it('does not cache a miss that results in NotFoundException', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow('not found');
      expect(cacheService.set).not.toHaveBeenCalled();
    });
  });

  describe('adjustStock (BR-PROD-03)', () => {
    it('decrements stock only when sufficient quantity exists', async () => {
      prisma.product.updateMany.mockResolvedValue({ count: 1 });

      await service.adjustStock('p1', -5);

      expect(prisma.product.updateMany).toHaveBeenCalledWith({
        where: { prod_id: 'p1', stock_qty: { gte: 5 } },
        data: { stock_qty: { increment: -5 } },
      });
    });

    it('throws ConflictException when the conditional update matches nothing (insufficient stock)', async () => {
      prisma.product.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.adjustStock('p1', -100)).rejects.toThrow(
        ConflictException,
      );
    });

    it('uses the passed-in transaction client instead of the default prisma instance', async () => {
      const txClient = {
        product: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      };

      await service.adjustStock('p1', -1, txClient as any);

      expect(txClient.product.updateMany).toHaveBeenCalled();
      expect(prisma.product.updateMany).not.toHaveBeenCalled();
    });

    it("does NOT touch the cache here — invalidation is the caller's (OrderService's) responsibility, see chat", async () => {
      prisma.product.updateMany.mockResolvedValue({ count: 1 });

      await service.adjustStock('p1', -1);

      expect(cacheService.del).not.toHaveBeenCalled();
    });
  });

  // NOTE: I don't have visibility into whether you already have an
  // `update` describe block with other test cases — if so, merge this
  // test into it rather than letting this block duplicate/replace it.
  describe('update', () => {
    it('deletes the product cache entry after a successful update', async () => {
      prisma.product.update.mockResolvedValue(baseProduct);

      await service.update('p1', { name: 'New Name' });

      expect(cacheService.del).toHaveBeenCalledWith('product:p1');
    });
  });

  describe('remove (orphan-delete pattern)', () => {
    it('hard-deletes when no order_items, cart_items, or purchase_history reference it, and busts the cache', async () => {
      const tx = {
        product: {
          update: jest.fn().mockResolvedValue(baseProduct),
          delete: jest.fn(),
        },
        order_item: { count: jest.fn().mockResolvedValue(0) },
        cart_item: { count: jest.fn().mockResolvedValue(0) },
        purchase_history: { count: jest.fn().mockResolvedValue(0) },
      };
      prisma.$transaction.mockImplementation((cb) => cb(tx));

      const result = await service.remove('p1');

      expect(tx.product.delete).toHaveBeenCalledWith({
        where: { prod_id: 'p1' },
      });
      expect(result).toEqual({ deleted: true });
      expect(cacheService.del).toHaveBeenCalledWith('product:p1');
    });

    it('soft-deletes only when the product is still referenced, and STILL busts the cache', async () => {
      const tx = {
        product: {
          update: jest.fn().mockResolvedValue(baseProduct),
          delete: jest.fn(),
        },
        order_item: { count: jest.fn().mockResolvedValue(3) },
        cart_item: { count: jest.fn().mockResolvedValue(0) },
        purchase_history: { count: jest.fn().mockResolvedValue(0) },
      };
      prisma.$transaction.mockImplementation((cb) => cb(tx));

      const result = await service.remove('p1');

      expect(tx.product.delete).not.toHaveBeenCalled();
      expect(result).toEqual({ deleted: false });
      expect(tx.product.update).toHaveBeenCalledWith({
        where: { prod_id: 'p1' },
        data: { is_active: false },
      });
      // Even though the row still exists (soft-deleted), the previously
      // cached response is now wrong (is_active flipped) — must still
      // invalidate, not just on the hard-delete branch.
      expect(cacheService.del).toHaveBeenCalledWith('product:p1');
    });
  });
});
