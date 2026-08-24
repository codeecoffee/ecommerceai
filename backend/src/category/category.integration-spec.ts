// src/category/category.integration-spec.ts
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { CategoryModule } from './category.module';
import { DatabaseService as PrismaService } from '../database/providers/database.service';
import { AuthModule } from '../auth/auth.module';
import { signTestJwt } from '../../test/util/sign-test-jwt';

describe('CategoryController (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let userToken: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [CategoryModule, AuthModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();

    prisma = moduleRef.get(PrismaService);

    const admin = await prisma.user.create({
      data: {
        first_name: 'Admin',
        last_name: 'Test',
        email: `cat-admin-${Date.now()}@test.com`,
        password_hash: 'x',
        role: 'ADMIN',
      },
    });
    const nonAdmin = await prisma.user.create({
      data: {
        first_name: 'User',
        last_name: 'Test',
        email: `cat-user-${Date.now()}@test.com`,
        password_hash: 'x',
      },
    });

    adminToken = signTestJwt({
      sub: admin.id,
      email: admin.email,
      role: admin.role,
    });
    userToken = signTestJwt({
      sub: nonAdmin.id,
      email: nonAdmin.email,
      role: nonAdmin.role,
    });
  });

  afterAll(async () => {
    await prisma.product.deleteMany({});
    await prisma.category.deleteMany({});
    await prisma.user.deleteMany({
      where: { email: { contains: '@test.com' } },
    });
    await app.close();
  });

  it('GET /categories is public', async () => {
    await request(app.getHttpServer()).get('/categories').expect(200);
  });

  it('POST /categories rejects non-admins with 403', async () => {
    await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'Books', description: 'x' })
      .expect(403);
  });

  it('creates a category, then rejects a parent update that would create a cycle', async () => {
    const parentRes = await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Electronics', description: 'x' })
      .expect(201);

    const childRes = await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Phones',
        description: 'x',
        parentCategoryId: parentRes.body.id,
      })
      .expect(201);

    // Try to make the parent's parent be its own child -> cycle.
    await request(app.getHttpServer())
      .patch(`/categories/${parentRes.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ parentCategoryId: childRes.body.id })
      .expect(400);
  });

  it('DELETE /categories/:id returns 409 when a product still references it', async () => {
    const catRes = await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Toys', description: 'x' })
      .expect(201);

    await prisma.product.create({
      data: {
        sku: `INT-CAT-${Date.now()}`,
        name: 'Toy',
        description: 'x',
        price: 5,
        stock_qty: 1,
        category_id: catRes.body.id,
      },
    });

    await request(app.getHttpServer())
      .delete(`/categories/${catRes.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(409);
  });

  it('GET /categories/tree nests subcategories', async () => {
    const parentRes = await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Home', description: 'x' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Furniture',
        description: 'x',
        parentCategoryId: parentRes.body.id,
      })
      .expect(201);

    const treeRes = await request(app.getHttpServer())
      .get('/categories/tree')
      .expect(200);
    const homeNode = treeRes.body.find((n: any) => n.id === parentRes.body.id);
    expect(homeNode.children.some((c: any) => c.name === 'Furniture')).toBe(
      true,
    );
  });
});
