// src/product/product.integration-spec.ts
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest'; // was: import * as request from 'supertest'
import { ProductModule } from './product.module';
import { DatabaseService as PrismaService } from '../database/providers/database.service';
import { AuthModule } from '../auth/auth.module';
import { signTestJwt } from '../../test/util/sign-test-jwt';

describe('ProductController (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let categoryId: string;
  let adminToken: string;
  let userToken: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ProductModule, AuthModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();

    prisma = moduleRef.get(PrismaService);

    const category = await prisma.category.create({
      data: { name: 'Electronics', description: 'Gadgets' },
    });
    categoryId = category.category_id;

    adminToken = signTestJwt({ sub: 'admin-1', role: 'ADMIN' });
    userToken = signTestJwt({ sub: 'user-1', role: 'USER' });
  });

  afterAll(async () => {
    await prisma.product.deleteMany({});
    await prisma.category.deleteMany({});
    await app.close();
  });

  describe('GET /products (public)', () => {
    it('returns 200 with no auth header at all — @Public() must actually bypass AuthGuard', async () => {
      await request(app.getHttpServer()).get('/products').expect(200);
    });

    it('never returns inactive products on the public route', async () => {
      const inactive = await prisma.product.create({
        data: {
          sku: 'INACTIVE-1',
          name: 'Ghost Product',
          description: 'x',
          price: 1,
          stock_qty: 1,
          is_active: false,
          category_id: categoryId,
        },
      });

      const res = await request(app.getHttpServer())
        .get('/products')
        .expect(200);
      expect(
        res.body.data.find((p: any) => p.id === inactive.prod_id),
      ).toBeUndefined();
    });
  });

  describe('POST /products (admin only)', () => {
    const validBody = {
      sku: 'SKU-INT-1',
      name: 'Test Widget',
      description: 'desc',
      price: 19.99,
      stockQty: 5,
      categoryId: '', // filled in each test
    };

    it('rejects with 401 when unauthenticated', async () => {
      await request(app.getHttpServer())
        .post('/products')
        .send({ ...validBody, categoryId })
        .expect(401);
    });

    it('rejects with 403 for an authenticated non-admin — proves RolesGuard is wired, not just AuthGuard', async () => {
      await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ ...validBody, categoryId })
        .expect(403);
    });

    it('creates the product for an admin', async () => {
      const res = await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...validBody, categoryId })
        .expect(201);

      expect(res.body.sku).toBe('SKU-INT-1');
      expect(res.body.categoryId).toBe(categoryId);
    });

    it('returns 400 for a nonexistent categoryId (BR-PROD-02) instead of a raw Prisma 500', async () => {
      await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ...validBody,
          sku: 'SKU-INT-2',
          categoryId: '11111111-1111-1111-1111-111111111111',
        })
        .expect(400);
    });

    it('returns 409 on duplicate sku instead of a raw Prisma 500', async () => {
      await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...validBody, categoryId })
        .expect(409); // SKU-INT-1 already created above
    });

    it('rejects unknown fields via whitelist/forbidNonWhitelisted', async () => {
      await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...validBody, sku: 'SKU-INT-3', categoryId, notAField: 'x' })
        .expect(400);
    });
  });

  describe('GET /products/admin', () => {
    it('is blocked for a non-admin even though it is only a GET', async () => {
      await request(app.getHttpServer())
        .get('/products/admin')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('includes inactive products for an admin', async () => {
      const res = await request(app.getHttpServer())
        .get('/products/admin')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.some((p: any) => p.isActive === false)).toBe(true);
    });
  });
});
