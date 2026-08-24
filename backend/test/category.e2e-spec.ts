import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

import { signTestJwt } from './util/sign-test-jwt';
import { DatabaseService as PrismaService } from '../src/database/providers/database.service';

describe('Category lifecycle (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let userToken: string;

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

    const admin = await prisma.user.create({
      data: {
        first_name: 'Admin',
        last_name: 'E2E',
        email: `cat-admin-e2e-${Date.now()}@test.com`,
        password_hash: 'x',
        role: 'ADMIN',
      },
    });
    const nonAdmin = await prisma.user.create({
      data: {
        first_name: 'User',
        last_name: 'E2E',
        email: `cat-user-e2e-${Date.now()}@test.com`,
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
    // Products before categories (FK), categories before users (no FK
    // between them, but keeping the teardown in dependency order as a habit
    // avoids surprises if that ever changes).
    await prisma.product.deleteMany({});
    await prisma.category.deleteMany({});
    await prisma.user.deleteMany({
      where: { email: { contains: '@test.com' } },
    });
    await app.close();
  });

  it('builds a three-level hierarchy and returns it correctly nested from /categories/tree', async () => {
    const grandparent = await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Electronics', description: 'Everything electronic' })
      .expect(201);

    const parent = await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Computers',
        description: 'Desktops and laptops',
        parentCategoryId: grandparent.body.id,
      })
      .expect(201);

    const child = await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Laptops',
        description: 'Portable computers',
        parentCategoryId: parent.body.id,
      })
      .expect(201);

    const treeRes = await request(app.getHttpServer())
      .get('/categories/tree')
      .expect(200);

    const grandparentNode = treeRes.body.find(
      (n: any) => n.id === grandparent.body.id,
    );
    expect(grandparentNode).toBeDefined();
    expect(grandparentNode.children).toHaveLength(1);

    const parentNode = grandparentNode.children[0];
    expect(parentNode.id).toBe(parent.body.id);
    expect(parentNode.children).toHaveLength(1);
    expect(parentNode.children[0].id).toBe(child.body.id);
  });

  it('rejects a parent reassignment that would create a cycle, end to end', async () => {
    const top = await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Home & Garden', description: 'x' })
      .expect(201);

    const mid = await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Furniture',
        description: 'x',
        parentCategoryId: top.body.id,
      })
      .expect(201);

    const leaf = await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Chairs', description: 'x', parentCategoryId: mid.body.id })
      .expect(201);

    // top -> mid -> leaf currently. Trying to make top's parent be leaf
    // would close the loop: top -> mid -> leaf -> top.
    await request(app.getHttpServer())
      .patch(`/categories/${top.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ parentCategoryId: leaf.body.id })
      .expect(400);

    // A category can't be its own parent either.
    await request(app.getHttpServer())
      .patch(`/categories/${mid.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ parentCategoryId: mid.body.id })
      .expect(400);

    // Hierarchy should be untouched after both rejected attempts.
    const reloaded = await request(app.getHttpServer())
      .get(`/categories/${top.body.id}`)
      .expect(200);
    expect(reloaded.body.parentCategoryId).toBeNull();
  });

  it('refuses to delete a category referenced by a product, then allows it once the product is reassigned', async () => {
    const source = await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Toys', description: 'x' })
      .expect(201);

    const destination = await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Games', description: 'x' })
      .expect(201);

    const product = await prisma.product.create({
      data: {
        sku: `CAT-E2E-${Date.now()}`,
        name: 'Board Game',
        description: 'x',
        price: 25,
        stock_qty: 4,
        category_id: source.body.id,
      },
    });

    await request(app.getHttpServer())
      .delete(`/categories/${source.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(409);

    // Reassign the product away, then deletion should succeed.
    await prisma.product.update({
      where: { prod_id: product.prod_id },
      data: { category_id: destination.body.id },
    });

    await request(app.getHttpServer())
      .delete(`/categories/${source.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/categories/${source.body.id}`)
      .expect(404);
  });

  it('refuses to delete a category that still has subcategories', async () => {
    const parent = await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Outdoor', description: 'x' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Camping',
        description: 'x',
        parentCategoryId: parent.body.id,
      })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/categories/${parent.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(409);
  });

  it('enforces admin-only writes end to end, while reads stay public', async () => {
    await request(app.getHttpServer())
      .post('/categories')
      .send({ name: 'No Auth', description: 'x' })
      .expect(401);

    await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'Non Admin', description: 'x' })
      .expect(403);

    // No Authorization header at all -- @Public() must actually bypass the guard.
    await request(app.getHttpServer()).get('/categories').expect(200);
    await request(app.getHttpServer()).get('/categories/tree').expect(200);
  });
});
