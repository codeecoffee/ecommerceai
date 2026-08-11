import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PostsService } from './posts.service';
import { UsersService } from '../../users/providers/users.service';
import { DatabaseService } from '../../database/providers/database.service';
import { PostsMapper } from '../mappers/posts.mapper';
import { Prisma } from '../../../prisma/src/generated/prisma/client';

/**
 * NOTE on scope: this file mocks DatabaseService completely, so it never
 * touches Postgres. It proves "given these DB responses, the service does
 * the right thing" -- it does NOT prove Prisma actually returns errors in
 * the shape we're assuming (P2003/P2025). That's the tradeoff of a pure
 * unit test; see posts.integration-spec.ts for what closes that gap.
 */
describe('PostsService', () => {
  let service: PostsService;
  let dbService: {
    product: { findUnique: jest.Mock };
    post: {
      create: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  const mockProduct = { prod_id: 'prod-1' };

  const mockPostRow = {
    post_id: 'post-1',
    product_id: 'prod-1',
    author_id: 'user-1',
    content: 'Great product',
    created_at: new Date('2026-01-01'),
    author: { id: 'user-1', first_name: 'Phil', last_name: 'D' },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostsService,
        // Unused by the service today (see note above), but still a
        // required constructor param -- Nest needs *something* to inject.
        { provide: UsersService, useValue: {} },
        {
          provide: DatabaseService,
          useValue: {
            product: { findUnique: jest.fn() },
            post: {
              create: jest.fn(),
              findMany: jest.fn(),
              count: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
        // Injected but called statically in the service -- see note above.
        { provide: PostsMapper, useValue: {} },
      ],
    }).compile();

    service = module.get(PostsService);
    dbService = module.get(DatabaseService);

    // PostsMapper is called as PostsMapper.toX(...), i.e. static, so
    // mocking the injected instance above does nothing -- we have to spy
    // on the class itself. We stub these with simple, predictable shapes
    // so service tests aren't coupled to the mapper's real implementation.
    jest
      .spyOn(PostsMapper, 'toCreateInput')
      .mockImplementation((dto: any, authorId: string, productId: string) => ({
        ...dto,
        author_id: authorId,
        product_id: productId,
      }));
    jest.spyOn(PostsMapper, 'toResponseDto').mockImplementation(
      (row: any) =>
        ({
          id: row.post_id,
          content: row.content,
          author: row.author,
        }) as any,
    );
    jest
      .spyOn(PostsMapper, 'toUpdateDto')
      .mockImplementation((dto: any) => dto);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createPost', () => {
    it('throws NotFoundException when the product does not exist, and never calls create', async () => {
      dbService.product.findUnique.mockResolvedValue(null);

      await expect(
        service.createPost('missing-prod', { content: 'x' } as any, 'user-1'),
      ).rejects.toThrow(NotFoundException);

      expect(dbService.post.create).not.toHaveBeenCalled();
    });

    it('creates a post and returns the mapped response when the product exists', async () => {
      dbService.product.findUnique.mockResolvedValue(mockProduct);
      dbService.post.create.mockResolvedValue(mockPostRow);

      const result = await service.createPost(
        'prod-1',
        { content: 'Great product' } as any,
        'user-1',
      );

      expect(dbService.post.create).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            author: { select: { id: true, first_name: true, last_name: true } },
          },
        }),
      );
      expect(result).toEqual(
        expect.objectContaining({ id: 'post-1', content: 'Great product' }),
      );
    });

    it('translates a P2003 (foreign key violation) into NotFoundException', async () => {
      dbService.product.findUnique.mockResolvedValue(mockProduct);
      dbService.post.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('FK violation', {
          code: 'P2003',
          clientVersion: '5.0.0',
        }),
      );

      await expect(
        service.createPost('prod-1', { content: 'x' } as any, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('rethrows errors that are not P2003 unchanged', async () => {
      dbService.product.findUnique.mockResolvedValue(mockProduct);
      dbService.post.create.mockRejectedValue(new Error('connection reset'));

      await expect(
        service.createPost('prod-1', { content: 'x' } as any, 'user-1'),
      ).rejects.toThrow('connection reset');
    });
  });

  describe('getAllPostsForProd', () => {
    it('computes skip/take from page and limit, and returns pagination metadata', async () => {
      dbService.post.findMany.mockResolvedValue([mockPostRow]);
      dbService.post.count.mockResolvedValue(45);

      const result = await service.getAllPostsForProd('prod-1', {
        page: 2,
        limit: 20,
      });

      expect(dbService.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 20 }),
      );
      expect(result.metadata).toEqual({
        total: 45,
        page: 2,
        limit: 20,
        totalPages: 3,
      });
    });

    it('defaults to page 1 / limit 20 when the query is empty', async () => {
      dbService.post.findMany.mockResolvedValue([]);
      dbService.post.count.mockResolvedValue(0);

      await service.getAllPostsForProd('prod-1', {});

      expect(dbService.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 }),
      );
    });
  });

  describe('getPostById', () => {
    it('throws NotFoundException when the post does not exist', async () => {
      dbService.post.findUnique.mockResolvedValue(null);
      await expect(service.getPostById('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns the mapped post when found', async () => {
      dbService.post.findUnique.mockResolvedValue(mockPostRow);
      const result = await service.getPostById('post-1');
      expect(result).toEqual(expect.objectContaining({ id: 'post-1' }));
    });
  });

  describe('getPostsByAuthor', () => {
    it('scopes the query to author_id and paginates', async () => {
      dbService.post.findMany.mockResolvedValue([mockPostRow]);
      dbService.post.count.mockResolvedValue(1);

      await service.getPostsByAuthor('user-1', { page: 1, limit: 20 });

      expect(dbService.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { author_id: 'user-1' } }),
      );
    });
  });

  describe('updatePost', () => {
    it('translates a P2025 (record not found) into NotFoundException', async () => {
      dbService.post.update.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('No record', {
          code: 'P2025',
          clientVersion: '5.0.0',
        }),
      );

      await expect(
        service.updatePost('missing', { content: 'edit' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('updates and returns the mapped post on success', async () => {
      dbService.post.update.mockResolvedValue({
        ...mockPostRow,
        content: 'edited',
      });

      const result = await service.updatePost('post-1', {
        content: 'edited',
      } as any);

      expect(result).toEqual(expect.objectContaining({ content: 'edited' }));
    });
  });

  describe('deletePost', () => {
    it('translates a P2025 into NotFoundException', async () => {
      dbService.post.delete.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('No record', {
          code: 'P2025',
          clientVersion: '5.0.0',
        }),
      );

      await expect(service.deletePost('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('resolves with no value when deletion succeeds', async () => {
      dbService.post.delete.mockResolvedValue(undefined);
      await expect(service.deletePost('post-1')).resolves.toBeUndefined();
    });
  });
});
