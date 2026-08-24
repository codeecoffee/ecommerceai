// src/category/provider/category.service.spec.ts
import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { CategoryService } from './category.service';
import { DatabaseService } from '../../database/providers/database.service';

describe('CategoryService', () => {
  let service: CategoryService;
  let db: {
    category: {
      create: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    product: { count: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    db = {
      category: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      product: { count: jest.fn() },
      $transaction: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [CategoryService, { provide: DatabaseService, useValue: db }],
    }).compile();

    service = module.get(CategoryService);
  });

  const baseCategory = {
    category_id: 'c1',
    name: 'Electronics',
    description: 'Gadgets',
    parent_category_id: null,
  };

  describe('create', () => {
    it('throws BadRequestException when parentCategoryId does not exist', async () => {
      db.category.findUnique.mockResolvedValue(null);

      await expect(
        service.create({
          name: 'Phones',
          description: 'x',
          parentCategoryId: 'missing',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(db.category.create).not.toHaveBeenCalled();
    });

    it('creates a top-level category with no parent check when parentCategoryId is omitted', async () => {
      db.category.create.mockResolvedValue(baseCategory);

      const result = await service.create({
        name: 'Electronics',
        description: 'x',
      });

      expect(db.category.findUnique).not.toHaveBeenCalled();
      expect(result).toEqual({
        id: 'c1',
        name: 'Electronics',
        description: 'Gadgets',
        parentCategoryId: null,
      });
    });
  });

  describe('update — cycle prevention', () => {
    it('rejects setting a category as its own parent', async () => {
      await expect(
        service.update('c1', { parentCategoryId: 'c1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a parent assignment that would create a cycle (grandchild becomes grandparent)', async () => {
      // Chain: c1 -> c2 -> c3. Trying to set c1's parent to c3 would loop
      // once you also imagine c3's parent eventually being c1 -- simulate
      // by making the walk from c3 arrive back at c1.
      db.category.findUnique
        .mockResolvedValueOnce({ category_id: 'c3' }) // assertParentExists(c3)
        .mockResolvedValueOnce({ parent_category_id: 'c1' }); // walk: c3's parent is c1

      await expect(
        service.update('c1', { parentCategoryId: 'c3' }),
      ).rejects.toThrow('circular category hierarchy');
    });

    it('allows a valid, non-cyclical parent reassignment', async () => {
      db.category.findUnique
        .mockResolvedValueOnce({ category_id: 'c2' }) // assertParentExists(c2)
        .mockResolvedValueOnce({ parent_category_id: null }); // walk terminates
      db.category.update.mockResolvedValue({
        ...baseCategory,
        parent_category_id: 'c2',
      });

      const result = await service.update('c1', { parentCategoryId: 'c2' });

      expect(result.parentCategoryId).toBe('c2');
    });
  });

  describe('remove', () => {
    it('blocks deletion when products still reference the category', async () => {
      db.product.count.mockResolvedValue(3);
      db.category.count.mockResolvedValue(0);

      await expect(service.remove('c1')).rejects.toThrow(ConflictException);
      expect(db.category.delete).not.toHaveBeenCalled();
    });

    it('blocks deletion when subcategories still reference it', async () => {
      db.product.count.mockResolvedValue(0);
      db.category.count.mockResolvedValue(2);

      await expect(service.remove('c1')).rejects.toThrow(ConflictException);
    });

    it('deletes when nothing references it', async () => {
      db.product.count.mockResolvedValue(0);
      db.category.count.mockResolvedValue(0);
      db.category.delete.mockResolvedValue(baseCategory);

      const result = await service.remove('c1');

      expect(db.category.delete).toHaveBeenCalledWith({
        where: { category_id: 'c1' },
      });
      expect(result).toEqual({ deleted: true });
    });
  });

  describe('findTree', () => {
    it('nests subcategories under their parent', async () => {
      db.category.findMany.mockResolvedValue([
        {
          category_id: 'p1',
          name: 'Electronics',
          description: 'x',
          parent_category_id: null,
        },
        {
          category_id: 'c1',
          name: 'Phones',
          description: 'x',
          parent_category_id: 'p1',
        },
      ]);

      const tree = await service.findTree();

      expect(tree).toHaveLength(1);
      expect(tree[0].id).toBe('p1');
      expect(tree[0].children).toHaveLength(1);
      expect(tree[0].children[0].id).toBe('c1');
    });
  });
});
