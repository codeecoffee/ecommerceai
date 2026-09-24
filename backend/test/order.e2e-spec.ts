import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/database/providers/database.service';

describe('Order (e2e)', () => {
  let app: INestApplication;
  let db: DatabaseService;
  let jwtService: JwtService;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();

    // Mirror main.ts's global pipe so e2e exercises the same pipeline
    // real requests hit.
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );

    await app.init();

    db = moduleRef.get(DatabaseService);

    // TODO: this only resolves if JwtModule is exported from whichever
    // module AppModule ultimately pulls it in from (commonly AuthModule).
    jwtService = moduleRef.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(async () => {
    // FK-safe order: children before parents.
    await db.purchase_history.deleteMany({});
    await db.order_item.deleteMany({});
    await db.cart_item.deleteMany({});
    await db.order.deleteMany({});
    await db.cart.deleteMany({});
    await db.product.deleteMany({});
    await db.category.deleteMany({});
    await db.user.deleteMany({});
    await db.address.deleteMany({});
  });

  // ---- helpers ----------------------------------------------------------

  function signToken(payload: { sub: string; email: string }) {
    return jwtService.sign(payload);
  }

  async function createAddress() {
    return db.address.create({
      data: {
        street: '1 Test St',
        city: 'Testville',
        state: 'TS',
        postal_code: '00000',
        country: 'US',
        normalized_key: `test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      } as any,
    });
  }

  async function createUser(
    overrides: { role?: string; address_id?: string } = {},
  ) {
    return db.user.create({
      data: {
        first_name: 'Order',
        last_name: 'Tester',
        email: `order-e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
        password_hash: 'irrelevant-for-e2e',
        // TODO: adjust to your actual Role enum values.
        role: overrides.role ?? 'USER',
        address_id: overrides.address_id,
      } as any,
    });
  }

  async function createProduct(
    overrides: { stock_qty?: number; price?: number } = {},
  ) {
    return db.product.create({
      data: {
        name: 'E2E Widget',
        price: overrides.price ?? 25,
        sku: `E2E-SKU-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        description: 'A product created for order e2e testing.',
        stock_qty: overrides.stock_qty ?? 10,
        category: {
          create: {
            name: `E2E Category ${Date.now()}-${Math.random().toString(36).slice(2)}`,
            description: 'A category created for order e2e testing.',
          },
        },
      } as any,
    });
  }

  async function seedActiveCart(
    token: string,
    prodId: string,
    quantity: number,
  ) {
    await request(app.getHttpServer())
      .post('/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: prodId, quantity })
      .expect(201);
  }

  // ---- checkout -----------------------------------------------------------

  describe('POST /orders', () => {
    it('checks out the active cart: creates an order, decrements stock, converts the cart', async () => {
      const address = await createAddress();
      const user = await createUser({ address_id: address.address_id });
      const product = await createProduct({ stock_qty: 10, price: 25 });
      const token = signToken({ sub: user.id, email: user.email });

      await seedActiveCart(token, product.prod_id, 3);

      const res = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(201);

      expect(res.body.status).toBe('PENDING');
      expect(res.body.total).toBe(75);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].priceAtPurchase).toBe(25);

      const updatedProduct = await db.product.findUniqueOrThrow({
        where: { prod_id: product.prod_id },
      });
      expect(updatedProduct.stock_qty).toBe(7);

      const purchaseHistory = await db.purchase_history.findMany({
        where: { order_id: res.body.orderId },
      });
      expect(purchaseHistory).toHaveLength(1);
    });

    it('returns 400 when the user has no active cart', async () => {
      const address = await createAddress();
      const user = await createUser({ address_id: address.address_id });
      const token = signToken({ sub: user.id, email: user.email });

      await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400);
    });

    it('returns 400 when the user has no address on file', async () => {
      const user = await createUser();
      const product = await createProduct();
      const token = signToken({ sub: user.id, email: user.email });
      await seedActiveCart(token, product.prod_id, 1);

      await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400);
    });

    it('rejects checkout when stock is depleted after the item was added to the cart', async () => {
      const address = await createAddress();
      const user = await createUser({ address_id: address.address_id });
      const product = await createProduct({ stock_qty: 5 });
      const token = signToken({ sub: user.id, email: user.email });

      // Add a normal, in-stock quantity -- Cart's own soft check (added
      // with the Cart module) would reject 9999 before checkout ever ran,
      // so that no longer exercises what this test is actually after.
      await seedActiveCart(token, product.prod_id, 3);

      // Simulate stock being depleted by something else (a concurrent
      // order, an admin adjustment) between add-to-cart and checkout --
      // this is what actually reaches adjustStock()'s atomic guard.
      await db.product.update({
        where: { prod_id: product.prod_id },
        data: { stock_qty: 1 },
      });

      await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect((res) => {
          if (![400, 409].includes(res.status)) {
            throw new Error(`expected 400 or 409, got ${res.status}`);
          }
        });

      const unchangedProduct = await db.product.findUniqueOrThrow({
        where: { prod_id: product.prod_id },
      });
      // Still 1 (the depleted value set above) -- confirms the failed
      // checkout didn't partially decrement stock before rolling back.
      expect(unchangedProduct.stock_qty).toBe(1);
    });

    it('returns 401 without a token', async () => {
      await request(app.getHttpServer()).post('/orders').send({}).expect(401);
    });
  });

  // ---- state machine ------------------------------------------------------

  describe('order state transitions', () => {
    it('walks an order through the full happy-path state machine', async () => {
      const address = await createAddress();
      const user = await createUser({ address_id: address.address_id });
      const admin = await createUser({ role: 'ADMIN' });
      const product = await createProduct();
      const token = signToken({ sub: user.id, email: user.email });
      const adminToken = signToken({ sub: admin.id, email: admin.email });

      await seedActiveCart(token, product.prod_id, 1);
      const checkoutRes = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(201);
      const orderId = checkoutRes.body.orderId;

      await request(app.getHttpServer())
        .patch(`/orders/${orderId}/confirm`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => expect(res.body.status).toBe('CONFIRMED'));

      await request(app.getHttpServer())
        .patch(`/orders/${orderId}/process`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/orders/${orderId}/ship`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/orders/${orderId}/deliver`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => expect(res.body.status).toBe('DELIVERED'));

      // DELIVERED -> CANCELLED is not a valid transition.
      await request(app.getHttpServer())
        .patch(`/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${token}`)
        .expect(409);
    });

    it('rejects a non-admin confirming an order', async () => {
      const address = await createAddress();
      const user = await createUser({ address_id: address.address_id });
      const product = await createProduct();
      const token = signToken({ sub: user.id, email: user.email });

      await seedActiveCart(token, product.prod_id, 1);
      const checkoutRes = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/orders/${checkoutRes.body.orderId}/confirm`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('cancelling a PENDING order releases the reserved stock', async () => {
      const address = await createAddress();
      const user = await createUser({ address_id: address.address_id });
      const product = await createProduct({ stock_qty: 10 });
      const token = signToken({ sub: user.id, email: user.email });

      await seedActiveCart(token, product.prod_id, 2);
      const checkoutRes = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(201);

      const afterCheckout = await db.product.findUniqueOrThrow({
        where: { prod_id: product.prod_id },
      });
      expect(afterCheckout.stock_qty).toBe(8);

      await request(app.getHttpServer())
        .patch(`/orders/${checkoutRes.body.orderId}/cancel`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect((res) => expect(res.body.status).toBe('CANCELLED'));

      const afterCancel = await db.product.findUniqueOrThrow({
        where: { prod_id: product.prod_id },
      });
      expect(afterCancel.stock_qty).toBe(10);
    });
  });

  // ---- ownership boundary -------------------------------------------------

  describe('GET /orders/:id (ownership boundary)', () => {
    it("returns 403 when a non-admin requests someone else's order", async () => {
      const address = await createAddress();
      const owner = await createUser({ address_id: address.address_id });
      const stranger = await createUser();
      const product = await createProduct();
      const ownerToken = signToken({ sub: owner.id, email: owner.email });
      const strangerToken = signToken({
        sub: stranger.id,
        email: stranger.email,
      });

      await seedActiveCart(ownerToken, product.prod_id, 1);
      const checkoutRes = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({})
        .expect(201);

      await request(app.getHttpServer())
        .get(`/orders/${checkoutRes.body.orderId}`)
        .set('Authorization', `Bearer ${strangerToken}`)
        .expect(403);
    });

    it("returns 200 when an admin requests someone else's order", async () => {
      const address = await createAddress();
      const owner = await createUser({ address_id: address.address_id });
      const admin = await createUser({ role: 'ADMIN' });
      const product = await createProduct();
      const ownerToken = signToken({ sub: owner.id, email: owner.email });
      const adminToken = signToken({ sub: admin.id, email: admin.email });

      await seedActiveCart(ownerToken, product.prod_id, 1);
      const checkoutRes = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({})
        .expect(201);

      await request(app.getHttpServer())
        .get(`/orders/${checkoutRes.body.orderId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('returns 200 when the owner requests their own order', async () => {
      const address = await createAddress();
      const owner = await createUser({ address_id: address.address_id });
      const product = await createProduct();
      const ownerToken = signToken({ sub: owner.id, email: owner.email });

      await seedActiveCart(ownerToken, product.prod_id, 1);
      const checkoutRes = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({})
        .expect(201);

      await request(app.getHttpServer())
        .get(`/orders/${checkoutRes.body.orderId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
    });
  });
});
