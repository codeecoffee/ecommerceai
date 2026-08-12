import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/database/providers/database.service';

/**
 * True e2e: real AppModule, real (test) Postgres via DatabaseService, real
 * JWT verification. Nothing here is mocked. Run against your existing test
 * DB via: pnpm test:e2e (make sure DATABASE_URL for that run points at the
 * test DB, not dev -- typically via a .env.test loaded before Jest starts).
 *
 * KNOWN FAILING TESTS RIGHT NOW, ON PURPOSE: the 'ownership boundary' block
 * below encodes the behavior OwnershipOrAdminGuard is *supposed* to have.
 * As currently written, that guard's no-@CheckOwnership fallback checks
 * request.params.id, but these routes use :postId and :authorId -- so the
 * "author edits their own post" and "author views their own posts" cases
 * will fail with 403 until you either rename the params to :id or add
 * @CheckOwnership(...) support for a custom paramName (and a 'post' case
 * in resolveOwnership, which doesn't exist yet either). Leave these tests
 * red as your target -- they're the spec for the fix, not a mistake to
 * "fix" by loosening the assertion.
 */
describe('Posts (e2e)', () => {
  let app: INestApplication;
  let db: DatabaseService;
  let jwtService: JwtService;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();

    // If main.ts applies a global ValidationPipe, mirror it here so e2e
    // tests exercise the same pipeline real requests hit.
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );

    await app.init();

    db = moduleRef.get(DatabaseService);

    // TODO: this only resolves if JwtModule is exported from whichever
    // module AppModule ultimately pulls it in from (commonly AuthModule).
    // If it throws "JwtService not found", export JwtModule from AuthModule,
    // or sign tokens with jsonwebtoken directly using the same secret
    // your JwtStrategy verifies against.
    jwtService = moduleRef.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(async () => {
    // FK-safe order: children before parents.
    await db.post.deleteMany({});
    await db.product.deleteMany({});
    await db.category.deleteMany({});
    await db.user.deleteMany({});
  });

  // ---- helpers ----------------------------------------------------------

  function signToken(payload: { sub: string; email: string }) {
    return jwtService.sign(payload);
  }

  async function createUser(overrides: { role?: string } = {}) {
    return db.user.create({
      data: {
        first_name: 'Test',
        last_name: 'User',
        email: `user-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
        password_hash: 'irrelevant-for-e2e',
        // TODO: adjust to your actual Role enum values.
        role: overrides.role ?? 'USER',
      } as any,
    });
  }

  async function createProduct() {
    return db.product.create({
      data: {
        name: 'Test Product',
        price: 10,
        sku: `TEST-SKU-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        description: 'A product created for e2e testing.',
        stock_qty: 100,
        category: {
          create: {
            name: `Test Category ${Date.now()}-${Math.random().toString(36).slice(2)}`,
            description: 'A category created for e2e testing.',
          },
        },
        // TODO: fill in any other required fields on your Product/Category models.
      } as any,
    });
  }

  // ---- create -------------------------------------------------------------

  describe('POST /products/:productId/posts', () => {
    it('creates a post and persists it with the correct foreign keys', async () => {
      const user = await createUser();
      const product = await createProduct();
      const token = signToken({ sub: user.id, email: user.email });

      const res = await request(app.getHttpServer())
        .post(`/products/${product.prod_id}/posts`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Solid product', rating: 5, comment: 'Great product' })
        .expect(201);

      // Not relying on the response body's field name for the post id here
      // (unknown ResponsePostDto shape) -- looking the row up by the FK
      // combination we know for certain instead.
      const row = await db.post.findFirst({
        where: { author_id: user.id, product_id: product.prod_id },
      });
      expect(row).not.toBeNull();
      expect(row?.author_id).toBe(user.id);
      expect(row?.product_id).toBe(product.prod_id);
      expect(res.status).toBe(201);
    });

    it('returns 404 when the product does not exist', async () => {
      const user = await createUser();
      const token = signToken({ sub: user.id, email: user.email });

      await request(app.getHttpServer())
        .post('/products/11111111-1111-1111-1111-111111111111/posts')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Valid title here', rating: 5 })
        .expect(404);
    });

    it('returns 401 without a token', async () => {
      const product = await createProduct();

      await request(app.getHttpServer())
        .post(`/products/${product.prod_id}/posts`)
        .send({ title: 'Valid title here', rating: 5 })
        .expect(401);
    });

    it('returns 400 for a malformed productId', async () => {
      const user = await createUser();
      const token = signToken({ sub: user.id, email: user.email });

      await request(app.getHttpServer())
        .post('/products/not-a-uuid/posts')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Valid title here', rating: 5 })
        .expect(400);
    });
  });

  // ---- read (public) -------------------------------------------------------

  describe('GET /products/:productId/posts', () => {
    it('requires no token and paginates correctly', async () => {
      const user = await createUser();
      const product = await createProduct();
      await db.post.createMany({
        data: Array.from({ length: 25 }, (_, i) => ({
          title: `Review ${i}`,
          rating: 4,
          comment: `Review ${i}`,
          author_id: user.id,
          product_id: product.prod_id,
        })) as any,
      });

      const res = await request(app.getHttpServer())
        .get(`/products/${product.prod_id}/posts`)
        .query({ page: 2, limit: 10 })
        .expect(200);

      expect(res.body.data).toHaveLength(10);
      expect(res.body.metadata).toEqual(
        expect.objectContaining({
          total: 25,
          page: 2,
          limit: 10,
          totalPages: 3,
        }),
      );
    });
  });

  describe('GET /posts/:postId', () => {
    it('returns 404 for a post that does not exist', async () => {
      await request(app.getHttpServer())
        .get('/posts/11111111-1111-1111-1111-111111111111')
        .expect(404);
    });
  });

  // ---- ownership boundary, the highest-value part of this file --------

  describe('PATCH /posts/:postId (ownership boundary)', () => {
    it('returns 403 when the caller is neither the author nor an admin', async () => {
      const author = await createUser();
      const stranger = await createUser();
      const product = await createProduct();
      const post = await db.post.create({
        data: {
          title: 'Original title',
          rating: 4,
          comment: 'original',
          author_id: author.id,
          product_id: product.prod_id,
        } as any,
      });
      const strangerToken = signToken({
        sub: stranger.id,
        email: stranger.email,
      });

      await request(app.getHttpServer())
        .patch(`/posts/${post.post_id}`)
        .set('Authorization', `Bearer ${strangerToken}`)
        .send({ comment: 'hijacked' })
        .expect(403);

      const unchanged = await db.post.findUnique({
        where: { post_id: post.post_id },
      });
      expect(unchanged?.comment).toBe('original');
    });

    it('[currently fails -- see file header] returns 200 when the caller is the author', async () => {
      const author = await createUser();
      const product = await createProduct();
      const post = await db.post.create({
        data: {
          title: 'Original title',
          rating: 4,
          comment: 'original',
          author_id: author.id,
          product_id: product.prod_id,
        } as any,
      });
      const token = signToken({ sub: author.id, email: author.email });

      await request(app.getHttpServer())
        .patch(`/posts/${post.post_id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ comment: 'edited by author' })
        .expect(200);
    });

    it('returns 200 when the caller is an admin, regardless of authorship', async () => {
      // OwnershipOrAdminGuard checks user.role === 'ADMIN' off req.user,
      // which JwtStrategy.validate() populates by re-fetching the full
      // user row via payload.email -- so role always comes from the DB,
      // never from the token. Confirmed against both the guard and
      // strategy source.
      const author = await createUser();
      const admin = await createUser({ role: 'ADMIN' });
      const product = await createProduct();
      const post = await db.post.create({
        data: {
          title: 'Original title',
          rating: 4,
          comment: 'original',
          author_id: author.id,
          product_id: product.prod_id,
        } as any,
      });
      const adminToken = signToken({ sub: admin.id, email: admin.email });

      await request(app.getHttpServer())
        .patch(`/posts/${post.post_id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ comment: 'edited by admin' })
        .expect(200);
    });
  });

  describe('GET /users/:authorId/posts (ownership boundary)', () => {
    it('[currently fails -- see file header] returns 200 when the caller requests their own posts', async () => {
      const user = await createUser();
      const product = await createProduct();
      await db.post.create({
        data: {
          title: 'My review',
          rating: 4,
          comment: 'my review',
          author_id: user.id,
          product_id: product.prod_id,
        } as any,
      });
      const token = signToken({ sub: user.id, email: user.email });

      await request(app.getHttpServer())
        .get(`/users/${user.id}/posts`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });

    it("returns 403 when a non-admin requests someone else's posts", async () => {
      const owner = await createUser();
      const stranger = await createUser();
      const token = signToken({ sub: stranger.id, email: stranger.email });

      await request(app.getHttpServer())
        .get(`/users/${owner.id}/posts`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it("returns 200 when an admin requests someone else's posts", async () => {
      const owner = await createUser();
      const admin = await createUser({ role: 'ADMIN' });
      const token = signToken({ sub: admin.id, email: admin.email });

      await request(app.getHttpServer())
        .get(`/users/${owner.id}/posts`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });
  });

  // ---- delete -----------------------------------------------------------

  describe('DELETE /posts/:postId', () => {
    it('[currently fails -- see file header] removes the row from the database when the caller is the author', async () => {
      const author = await createUser();
      const product = await createProduct();
      const post = await db.post.create({
        data: {
          title: 'To delete',
          rating: 3,
          comment: 'to delete',
          author_id: author.id,
          product_id: product.prod_id,
        } as any,
      });
      const token = signToken({ sub: author.id, email: author.email });

      await request(app.getHttpServer())
        .delete(`/posts/${post.post_id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200); // TODO: your controller types this as Promise<void> -- confirm 200 vs 204

      const row = await db.post.findUnique({
        where: { post_id: post.post_id },
      });
      expect(row).toBeNull();
    });
  });

  // ---- real FK/cascade behavior -- the reason this needs a real DB ----

  describe('deleting a product with existing posts', () => {
    it("proves what actually happens -- adjust the expectation to match your schema's onDelete rule, don't assume", async () => {
      const author = await createUser();
      const product = await createProduct();
      await db.post.create({
        data: {
          title: 'Orphan risk',
          rating: 3,
          comment: 'orphan risk',
          author_id: author.id,
          product_id: product.prod_id,
        } as any,
      });

      // If Post.product has onDelete: Cascade, this succeeds and the post
      // is gone with it. If it's Restrict (Prisma's default), this delete
      // throws instead. Run this once and see which one your schema
      // actually does -- then lock that in as the assertion, rather than
      // writing the assertion you assumed and letting it silently pass or
      // fail against a schema change later.
      await db.product.delete({ where: { prod_id: product.prod_id } });

      const remaining = await db.post.findMany({
        where: { product_id: product.prod_id },
      });
      expect(remaining).toHaveLength(0);
    });
  });
});
