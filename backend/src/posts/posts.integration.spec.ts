import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import request from 'supertest';
import { PostsController } from './posts.controller';
import { PostsService } from './providers/posts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OwnershipOrAdminGuard } from '../auth/guards/ownership-or-admin.guard';
import { DatabaseService } from '../database/providers/database.service';

/**
 * Integration tier: real Nest HTTP pipeline (pipes, guards, decorators all
 * execute for real), but nothing touches a database -- DatabaseService is
 * mocked, and PostsService is mocked (its own logic is covered by
 * posts.service.spec.ts). This is the tier that catches wiring bugs a
 * controller unit test structurally can't see, without paying for a real
 * Postgres instance.
 *
 * Two guards are handled very differently on purpose:
 *
 *  - JwtAuthGuard is overridden with a fake. We don't want to stand up a
 *    real passport 'jwt' strategy here -- that's what posts.e2e-spec.ts is
 *    for. One consequence: the real @Public()-bypass logic inside
 *    JwtAuthGuard (the `isPulic` check) is NOT exercised here, since we
 *    replaced the whole guard. If you want that specific logic covered
 *    too, it needs to live in the e2e file against the real guard.
 *
 *  - OwnershipOrAdminGuard is left REAL, with its own dependencies
 *    (Reflector, DatabaseService) provided directly. This is the guard
 *    that had the :id vs :postId/:authorId bug -- these tests are the
 *    ones that would have caught it, and they're written for the FIXED
 *    behavior. They assume:
 *      1. @CheckOwnership({ resource: 'post', paramName: 'postId' }) is
 *         on updatePost and deletePost in posts.controller.ts
 *      2. @CheckOwnership({ resource: 'user', paramName: 'authorId' }) is
 *         on getPostsByAuthor
 *      3. resolveOwnership has a `case 'user': return resourceId === userId;`
 *         branch in ownership-or-admin.guard.ts
 *    If any of those haven't been applied yet, the corresponding test
 *    below will fail -- that failure IS the bug, not a mistake in the test.
 */
describe('Posts (integration)', () => {
  let app: INestApplication;
  let postsService: Record<string, jest.Mock>;
  let dbService: { post: { findUnique: jest.Mock } };
  let currentUser: { id: string; role: string } | null;

  beforeAll(async () => {
    postsService = {
      createPost: jest.fn(),
      getAllPostsForProd: jest.fn(),
      getPostById: jest.fn(),
      getPostsByAuthor: jest.fn(),
      updatePost: jest.fn(),
      deletePost: jest.fn(),
    };

    dbService = {
      post: { findUnique: jest.fn() },
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [PostsController],
      providers: [
        { provide: PostsService, useValue: postsService },
        { provide: DatabaseService, useValue: dbService },
        Reflector,
        OwnershipOrAdminGuard, // real -- this is the class under test here
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          req.user = currentUser;
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    currentUser = null;
    jest.clearAllMocks();
  });

  // ---- @CurrentUser() wiring -------------------------------------------

  it('POST /products/:productId/posts resolves the current user from the request, not from the query string', async () => {
    currentUser = { id: 'user-1', role: 'USER' };
    postsService.createPost.mockResolvedValue({ id: 'post-1' });

    await request(app.getHttpServer())
      .post('/products/11111111-1111-1111-1111-111111111111/posts')
      // Deliberately try to spoof a different author via query string --
      // if @CurrentUser() is wired correctly, this must be ignored.
      .query({ authorId: 'attacker-id' })
      .send({ title: 'Solid product', rating: 5, comment: 'nice product' })
      .expect(201);

    expect(postsService.createPost).toHaveBeenCalledWith(
      '11111111-1111-1111-1111-111111111111',
      { title: 'Solid product', rating: 5, comment: 'nice product' },
      'user-1', // must come from the (faked) authenticated request, not the query
    );
  });

  // ---- pipes -------------------------------------------------------------

  it('GET /products/:productId/posts rejects a non-UUID productId (ParseUUIDPipe)', async () => {
    await request(app.getHttpServer())
      .get('/products/not-a-uuid/posts')
      .expect(400);
  });

  // ---- public routes ------------------------------------------------------

  it('GET /products/:productId/posts is reachable with no Authorization header', async () => {
    // Note: JwtAuthGuard is faked here, so this doesn't prove the real
    // @Public() bypass works -- see the file header. It only proves the
    // route doesn't otherwise require something we're not sending.
    postsService.getAllPostsForProd.mockResolvedValue({
      data: [],
      metadata: { total: 0, page: 1, limit: 20, totalPages: 0 },
    });

    await request(app.getHttpServer())
      .get('/products/11111111-1111-1111-1111-111111111111/posts')
      .expect(200);
  });

  it('GET /posts/:postId is reachable with no Authorization header', async () => {
    postsService.getPostById.mockResolvedValue({ id: 'post-1' });

    await request(app.getHttpServer())
      .get('/posts/11111111-1111-1111-1111-111111111111')
      .expect(200);
  });

  // ---- OwnershipOrAdminGuard: the guard that had the param-name bug ----

  describe('PATCH /posts/:postId (ownership boundary)', () => {
    it('returns 403 when the caller is neither the author nor an admin', async () => {
      currentUser = { id: 'stranger-1', role: 'USER' };
      dbService.post.findUnique.mockResolvedValue({ author_id: 'author-1' });

      await request(app.getHttpServer())
        .patch('/posts/22222222-2222-2222-2222-222222222222')
        .send({ comment: 'hijacked' })
        .expect(403);

      expect(postsService.updatePost).not.toHaveBeenCalled();
    });

    it('returns 200 when the caller is the author', async () => {
      currentUser = { id: 'author-1', role: 'USER' };
      dbService.post.findUnique.mockResolvedValue({ author_id: 'author-1' });
      postsService.updatePost.mockResolvedValue({
        id: 'post-1',
        comment: 'edited',
      });

      await request(app.getHttpServer())
        .patch('/posts/22222222-2222-2222-2222-222222222222')
        .send({ comment: 'edited' })
        .expect(200);

      expect(postsService.updatePost).toHaveBeenCalledWith(
        '22222222-2222-2222-2222-222222222222',
        { comment: 'edited' },
      );
    });

    it('returns 200 when the caller is an admin, regardless of authorship, without needing a DB lookup', async () => {
      currentUser = { id: 'admin-1', role: 'ADMIN' };
      postsService.updatePost.mockResolvedValue({
        id: 'post-1',
        comment: 'edited by admin',
      });

      await request(app.getHttpServer())
        .patch('/posts/22222222-2222-2222-2222-222222222222')
        .send({ comment: 'edited by admin' })
        .expect(200);

      // Admin bypass short-circuits in the guard before resolveOwnership
      // runs -- so the DB should never even be queried for this case.
      expect(dbService.post.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /posts/:postId (ownership boundary)', () => {
    it('returns 403 when the caller is neither the author nor an admin', async () => {
      currentUser = { id: 'stranger-1', role: 'USER' };
      dbService.post.findUnique.mockResolvedValue({ author_id: 'author-1' });

      await request(app.getHttpServer())
        .delete('/posts/22222222-2222-2222-2222-222222222222')
        .expect(403);

      expect(postsService.deletePost).not.toHaveBeenCalled();
    });

    it('returns 200 when the caller is the author', async () => {
      currentUser = { id: 'author-1', role: 'USER' };
      dbService.post.findUnique.mockResolvedValue({ author_id: 'author-1' });
      postsService.deletePost.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .delete('/posts/22222222-2222-2222-2222-222222222222')
        .expect(200); // TODO: confirm 200 vs 204 against your controller's actual response
    });
  });

  describe('GET /users/:authorId/posts (ownership boundary)', () => {
    it('returns 200 when the caller requests their own posts', async () => {
      currentUser = { id: 'user-1', role: 'USER' };
      postsService.getPostsByAuthor.mockResolvedValue({
        data: [],
        metadata: { total: 0, page: 1, limit: 20, totalPages: 0 },
      });

      // This route's ownership check is a plain param === userId compare
      // (case 'user' in resolveOwnership) -- no DB lookup needed, unlike
      // the post-ownership cases above.
      await request(app.getHttpServer()).get('/users/user-1/posts').expect(200);

      expect(dbService.post.findUnique).not.toHaveBeenCalled();
    });

    it("returns 403 when a non-admin requests someone else's posts", async () => {
      currentUser = { id: 'stranger-1', role: 'USER' };

      await request(app.getHttpServer()).get('/users/user-1/posts').expect(403);

      expect(postsService.getPostsByAuthor).not.toHaveBeenCalled();
    });

    it("returns 200 when an admin requests someone else's posts", async () => {
      currentUser = { id: 'admin-1', role: 'ADMIN' };
      postsService.getPostsByAuthor.mockResolvedValue({
        data: [],
        metadata: { total: 0, page: 1, limit: 20, totalPages: 0 },
      });

      await request(app.getHttpServer()).get('/users/user-1/posts').expect(200);
    });
  });
});
