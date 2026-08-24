// test/product.e2e-spec.ts
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

import { signTestJwt } from './util/sign-test-jwt';
import { DatabaseService as PrismaService } from '../src/database/providers/database.service';
import { ProductService } from '../src/product/provider/product.service';

describe('Product lifecycle (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();
    prisma = moduleRef.get(PrismaService);

    // JwtStrategy.validate() looks the user up by email against the real
    // DB and returns that row as request.user — RolesGuard then checks
    // *that* row's role, not any claim baked into the JWT payload. So the
    // token is only as good as a real, correctly-roled user behind it.
    const adminUser = await prisma.user.create({
      data: {
        first_name: 'Admin',
        last_name: 'E2E',
        email: `admin-e2e-${Date.now()}@test.com`,
        password_hash: 'x',
        role: 'ADMIN',
      },
    });
    adminToken = signTestJwt({
      sub: adminUser.id,
      email: adminUser.email,
      role: adminUser.role,
    });
  });

  afterAll(async () => {
    await prisma.purchase_history.deleteMany({});
    await prisma.order.deleteMany({});
    await prisma.address.deleteMany({});
    await prisma.product.deleteMany({});
    await prisma.category.deleteMany({});
    await prisma.user.deleteMany({
      where: { email: { contains: '@test.com' } },
    });
    await app.close();
  });

  it('hard-deletes a never-ordered product, but only soft-deletes one with purchase history', async () => {
    const category = await prisma.category.create({
      data: { name: 'Books', description: 'x' },
    });

    const createRes = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        sku: 'E2E-1',
        name: 'Novel',
        description: 'x',
        price: 12.5,
        stockQty: 3,
        categoryId: category.category_id,
      })
      .expect(201);

    const productId = createRes.body.id;

    const del1 = await request(app.getHttpServer())
      .delete(`/products/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(del1.body.deleted).toBe(true);

    await request(app.getHttpServer())
      .get(`/products/${productId}`)
      .expect(404);

    const createRes2 = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        sku: 'E2E-2',
        name: 'Novel 2',
        description: 'x',
        price: 12.5,
        stockQty: 3,
        categoryId: category.category_id,
      })
      .expect(201);
    const productId2 = createRes2.body.id;

    const user = await prisma.user.create({
      data: {
        first_name: 'E2E',
        last_name: 'Tester',
        email: `e2e-${Date.now()}@test.com`,
        password_hash: 'x',
      },
    });
    const address = await prisma.address.create({
      data: {
        street: 's',
        city: 'c',
        state: 'st',
        postal_code: '0',
        country: 'US',
        normalized_key: `k-${Date.now()}`,
      },
    });
    const order = await prisma.order.create({
      data: {
        status: 'DELIVERED',
        total: 12.5,
        user_id: user.id,
        address_id: address.address_id,
      },
    });
    await prisma.purchase_history.create({
      data: {
        user_id: user.id,
        prod_id: productId2,
        order_id: order.order_id,
        quantity: 1,
        price_paid: 12.5,
      } as any,
    });

    const del2 = await request(app.getHttpServer())
      .delete(`/products/${productId2}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(del2.body.deleted).toBe(false);

    const getRes = await request(app.getHttpServer())
      .get(`/products/${productId2}`)
      .expect(200);
    expect(getRes.body.isActive).toBe(false);

    const listRes = await request(app.getHttpServer())
      .get('/products')
      .expect(200);
    expect(
      listRes.body.data.find((p: any) => p.id === productId2),
    ).toBeUndefined();
  });

  it('rejects a stock decrement below zero end-to-end via the adjustStock hook', async () => {
    const productService = app.get(ProductService);

    const category = await prisma.category.create({
      data: { name: 'Toys', description: 'x' },
    });
    const product = await prisma.product.create({
      data: {
        sku: `E2E-STOCK-${Date.now()}`,
        name: 'Toy',
        description: 'x',
        price: 5,
        stock_qty: 2,
        category_id: category.category_id,
      },
    });

    await expect(
      productService.adjustStock(product.prod_id, -3),
    ).rejects.toThrow();

    const reloaded = await prisma.product.findUnique({
      where: { prod_id: product.prod_id },
    });
    expect(reloaded!.stock_qty).toBe(2);
  });
});
