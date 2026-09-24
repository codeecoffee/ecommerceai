import { Test } from '@nestjs/testing';
import { ExecutionContext, INestApplication } from '@nestjs/common';
import request from 'supertest';

import { OrderController } from './order.controller';
import { OrderService } from './provider/order.service';

// Adjust these import paths to match your actual auth module location.
import { JwtAuthGuard as AuthGuard } from '../../src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { OwnershipOrAdminGuard } from '../auth/guards/ownership-or-admin.guard';

/**
 * These tests exist to catch what unit tests structurally cannot: guard
 * wiring, decorator resolution (@CurrentUser, @Roles, @CheckOwnership),
 * and route-declaration order — not business logic, which is covered in
 * order.service.spec.ts. OrderService is fully mocked here.
 *
 * AuthGuard/RolesGuard/OwnershipOrAdminGuard are overridden with fakes
 * driven by an `x-test-user` header, so each test controls the request's
 * authenticated identity without touching real JWT/DB logic.
 */
describe('OrderController (integration)', () => {
  let app: INestApplication;
  const orderService = {
    checkout: jest.fn(),
    findAllForUser: jest.fn(),
    findAllAdmin: jest.fn(),
    findOne: jest.fn(),
    confirm: jest.fn(),
    cancel: jest.fn(),
  };

  function fakeUserFromHeader(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const header = req.headers['x-test-user'];
    if (!header) return null;
    const user = JSON.parse(header as string);
    req.user = user;
    return user;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [OrderController],
      providers: [{ provide: OrderService, useValue: orderService }],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: (ctx: ExecutionContext) => !!fakeUserFromHeader(ctx),
      })
      .overrideGuard(RolesGuard)
      .useValue({
        canActivate: (ctx: ExecutionContext) => {
          const user = fakeUserFromHeader(ctx);
          return user?.role === 'ADMIN';
        },
      })
      .overrideGuard(OwnershipOrAdminGuard)
      .useValue({
        // Ownership resolution itself is exercised elsewhere; here we just
        // need it to pass through so we can verify the controller wiring.
        canActivate: () => true,
      })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('rejects POST /orders with no authenticated user (401)', async () => {
    await request(app.getHttpServer()).post('/orders').expect(401);
    expect(orderService.checkout).not.toHaveBeenCalled();
  });

  it('passes the authenticated user id from @CurrentUser() through to checkout()', async () => {
    orderService.checkout.mockResolvedValue({ orderId: 'o1' });

    await request(app.getHttpServer())
      .post('/orders')
      .set('x-test-user', JSON.stringify({ id: 'u1', role: 'USER' }))
      .expect(201);

    // This is the decorator-wiring assertion: if @CurrentUser() were
    // swapped for the wrong decorator (or misconfigured), this call
    // either wouldn't happen or would receive `undefined`.
    expect(orderService.checkout).toHaveBeenCalledWith('u1');
  });

  it('GET /orders/admin is reachable and routed to findAllAdmin, not swallowed by GET /orders/:id', async () => {
    orderService.findAllAdmin.mockResolvedValue({ data: [], metadata: null });

    await request(app.getHttpServer())
      .get('/orders/admin')
      .set('x-test-user', JSON.stringify({ id: 'admin1', role: 'ADMIN' }))
      .expect(200);

    expect(orderService.findAllAdmin).toHaveBeenCalled();
    expect(orderService.findOne).not.toHaveBeenCalled();
  });

  it('GET /orders/admin returns 403 for a non-admin user', async () => {
    await request(app.getHttpServer())
      .get('/orders/admin')
      .set('x-test-user', JSON.stringify({ id: 'u1', role: 'USER' }))
      .expect(403);

    expect(orderService.findAllAdmin).not.toHaveBeenCalled();
  });

  it('GET /orders/:id resolves the id param and calls findOne', async () => {
    orderService.findOne.mockResolvedValue({ orderId: 'o1' });

    await request(app.getHttpServer())
      .get('/orders/o1')
      .set('x-test-user', JSON.stringify({ id: 'u1', role: 'USER' }))
      .expect(200);

    expect(orderService.findOne).toHaveBeenCalledWith('o1');
  });

  it('PATCH /orders/:id/confirm requires ADMIN role', async () => {
    await request(app.getHttpServer())
      .patch('/orders/o1/confirm')
      .set('x-test-user', JSON.stringify({ id: 'u1', role: 'USER' }))
      .expect(403);

    expect(orderService.confirm).not.toHaveBeenCalled();
  });

  it('PATCH /orders/:id/cancel is reachable by a non-admin owner (OwnershipOrAdminGuard, not RolesGuard)', async () => {
    orderService.cancel.mockResolvedValue({
      orderId: 'o1',
      status: 'CANCELLED',
    });

    await request(app.getHttpServer())
      .patch('/orders/o1/cancel')
      .set('x-test-user', JSON.stringify({ id: 'u1', role: 'USER' }))
      .expect(200);

    expect(orderService.cancel).toHaveBeenCalledWith('o1');
  });
});
