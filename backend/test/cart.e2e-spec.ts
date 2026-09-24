import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/database/providers/database.service';

describe('Cart (e2e)', () => {
  let app: INestApplication;
  let db: DatabaseService;
  let jwtService: JwtService;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    db = moduleRef.get(DatabaseService);
    jwtService = moduleRef.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(async () => {
    // FK-safe order: children before parents.
    await db.cart_item.deleteMany({});
    await db.cart.deleteMany({});
    await db.product.deleteMany({});
    await db.category.deleteMany({});
    await db.user.deleteMany({});
  });

  function signToken(payload: { sub: string; email: string }) {
    return jwtService.sign(payload);
  }

  async function createUser() {
    return db.user.create({
      data: {
        first_name: 'Cart',
        last_name: 'Tester',
        email: `cart-e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
        password_hash: 'irrelevant-for-e2e',
        role: 'USER',
      } as any,
    });
  }

  async function createProduct(
    overrides: { stock_qty?: number; price?: number } = {},
  ) {
    return db.product.create({
      data: {
        name: 'E2E Cart Widget',
        price: overrides.price ?? 15,
        sku: `CART-E2E-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        description: 'A product created for cart e2e testing.',
        stock_qty: overrides.stock_qty ?? 10,
        category: {
          create: {
            name: `E2E Cart Category ${Date.now()}-${Math.random().toString(36).slice(2)}`,
            description: 'A category created for cart e2e testing.',
          },
        },
      } as any,
    });
  }

  describe('GET /cart', () => {
    it('returns an empty cart shape for a user with nothing added yet', async () => {
      const user = await createUser();
      const token = signToken({ sub: user.id, email: user.email });

      const res = await request(app.getHttpServer())
        .get('/cart')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toEqual({
        cartId: null,
        status: null,
        items: [],
        total: 0,
      });
    });

    it('returns 401 without a token', async () => {
      await request(app.getHttpServer()).get('/cart').expect(401);
    });
  });

  describe('POST /cart/items', () => {
    it('lazily creates a cart and adds the item', async () => {
      const user = await createUser();
      const product = await createProduct({ stock_qty: 10, price: 15 });
      const token = signToken({ sub: user.id, email: user.email });

      const res = await request(app.getHttpServer())
        .post('/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({ productId: product.prod_id, quantity: 2 })
        .expect(201);

      expect(res.body.cartId).not.toBeNull();
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].quantity).toBe(2);
      expect(res.body.total).toBe(30);

      const cartRow = await db.cart.findFirst({
        where: { user_id: user.id, status: 'ACTIVE' },
      });
      expect(cartRow).not.toBeNull();
    });

    it('increments quantity instead of creating a duplicate line when adding the same product twice', async () => {
      const user = await createUser();
      const product = await createProduct({ stock_qty: 10 });
      const token = signToken({ sub: user.id, email: user.email });

      await request(app.getHttpServer())
        .post('/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({ productId: product.prod_id, quantity: 2 })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post('/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({ productId: product.prod_id, quantity: 3 })
        .expect(201);

      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].quantity).toBe(5);
    });

    it('rejects a quantity that exceeds current stock', async () => {
      const user = await createUser();
      const product = await createProduct({ stock_qty: 3 });
      const token = signToken({ sub: user.id, email: user.email });

      await request(app.getHttpServer())
        .post('/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({ productId: product.prod_id, quantity: 5 })
        .expect(400);
    });

    it('returns 404 for a nonexistent product', async () => {
      const user = await createUser();
      const token = signToken({ sub: user.id, email: user.email });

      await request(app.getHttpServer())
        .post('/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: '11111111-1111-1111-1111-111111111111',
          quantity: 1,
        })
        .expect(404);
    });
  });

  describe('PATCH /cart/items/:id and ownership', () => {
    it('updates the quantity of an existing line item', async () => {
      const user = await createUser();
      const product = await createProduct({ stock_qty: 10 });
      const token = signToken({ sub: user.id, email: user.email });

      const addRes = await request(app.getHttpServer())
        .post('/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({ productId: product.prod_id, quantity: 2 })
        .expect(201);
      const cartItemId = addRes.body.items[0].cartItemId;

      const patchRes = await request(app.getHttpServer())
        .patch(`/cart/items/${cartItemId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ quantity: 7 })
        .expect(200);

      expect(patchRes.body.items[0].quantity).toBe(7);
    });

    it("returns 403 when a user tries to modify someone else's cart item", async () => {
      const owner = await createUser();
      const stranger = await createUser();
      const product = await createProduct({ stock_qty: 10 });
      const ownerToken = signToken({ sub: owner.id, email: owner.email });
      const strangerToken = signToken({
        sub: stranger.id,
        email: stranger.email,
      });

      const addRes = await request(app.getHttpServer())
        .post('/cart/items')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ productId: product.prod_id, quantity: 2 })
        .expect(201);
      const cartItemId = addRes.body.items[0].cartItemId;

      await request(app.getHttpServer())
        .patch(`/cart/items/${cartItemId}`)
        .set('Authorization', `Bearer ${strangerToken}`)
        .send({ quantity: 5 })
        .expect(403);

      await request(app.getHttpServer())
        .delete(`/cart/items/${cartItemId}`)
        .set('Authorization', `Bearer ${strangerToken}`)
        .expect(403);
    });
  });

  describe('DELETE /cart/items/:id', () => {
    it('removes a single line item', async () => {
      const user = await createUser();
      const product = await createProduct({ stock_qty: 10 });
      const token = signToken({ sub: user.id, email: user.email });

      const addRes = await request(app.getHttpServer())
        .post('/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({ productId: product.prod_id, quantity: 2 })
        .expect(201);
      const cartItemId = addRes.body.items[0].cartItemId;

      const delRes = await request(app.getHttpServer())
        .delete(`/cart/items/${cartItemId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(delRes.body.items).toHaveLength(0);

      const row = await db.cart_item.findUnique({
        where: { cart_item_id: cartItemId },
      });
      expect(row).toBeNull();
    });
  });

  describe('DELETE /cart', () => {
    it('clears all items but leaves the cart ACTIVE', async () => {
      const user = await createUser();
      const product = await createProduct({ stock_qty: 10 });
      const token = signToken({ sub: user.id, email: user.email });

      await request(app.getHttpServer())
        .post('/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({ productId: product.prod_id, quantity: 2 })
        .expect(201);

      await request(app.getHttpServer())
        .delete('/cart')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect((res) => expect(res.body).toEqual({ deleted: true }));

      const cartRow = await db.cart.findFirst({
        where: { user_id: user.id, status: 'ACTIVE' },
      });
      expect(cartRow).not.toBeNull();
      const items = await db.cart_item.findMany({
        where: { cart_id: cartRow!.cart_id },
      });
      expect(items).toHaveLength(0);
    });

    it('returns { deleted: false } when there is nothing to clear', async () => {
      const user = await createUser();
      const token = signToken({ sub: user.id, email: user.email });

      await request(app.getHttpServer())
        .delete('/cart')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect((res) => expect(res.body).toEqual({ deleted: false }));
    });
  });
});
