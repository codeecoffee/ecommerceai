import { Test } from '@nestjs/testing';
import { ExecutionContext, INestApplication } from '@nestjs/common';
import request from 'supertest';

import { CartController } from './cart.controller';
import { CartService } from './provider/cart.service';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

describe('CartController (integration)', () => {
  let app: INestApplication;
  const cartService = {
    getCart: jest.fn(),
    addItem: jest.fn(),
    updateItemQuantity: jest.fn(),
    removeItem: jest.fn(),
    clearCart: jest.fn(),
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
      controllers: [CartController],
      providers: [{ provide: CartService, useValue: cartService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: ExecutionContext) => !!fakeUserFromHeader(ctx),
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

  it('rejects every route with no authenticated user (401)', async () => {
    await request(app.getHttpServer()).get('/cart').expect(401);
    await request(app.getHttpServer()).post('/cart/items').send({}).expect(401);
    expect(cartService.getCart).not.toHaveBeenCalled();
    expect(cartService.addItem).not.toHaveBeenCalled();
  });

  it('passes the authenticated user id from @CurrentUser() through to getCart()', async () => {
    cartService.getCart.mockResolvedValue({
      cartId: null,
      status: null,
      items: [],
      total: 0,
    });

    await request(app.getHttpServer())
      .get('/cart')
      .set('x-test-user', JSON.stringify({ id: 'u1' }))
      .expect(200);

    expect(cartService.getCart).toHaveBeenCalledWith('u1');
  });

  it('POST /cart/items passes both the user id and the body through to addItem()', async () => {
    cartService.addItem.mockResolvedValue({
      cartId: 'c1',
      status: 'ACTIVE',
      items: [],
      total: 0,
    });

    await request(app.getHttpServer())
      .post('/cart/items')
      .set('x-test-user', JSON.stringify({ id: 'u1' }))
      .send({ productId: '11111111-1111-1111-1111-111111111111', quantity: 2 })
      .expect(201);

    expect(cartService.addItem).toHaveBeenCalledWith('u1', {
      productId: '11111111-1111-1111-1111-111111111111',
      quantity: 2,
    });
  });

  it('PATCH /cart/items/:id resolves the id param correctly', async () => {
    cartService.updateItemQuantity.mockResolvedValue({
      cartId: 'c1',
      status: 'ACTIVE',
      items: [],
      total: 0,
    });

    await request(app.getHttpServer())
      .patch('/cart/items/ci1')
      .set('x-test-user', JSON.stringify({ id: 'u1' }))
      .send({ quantity: 3 })
      .expect(200);

    expect(cartService.updateItemQuantity).toHaveBeenCalledWith('u1', 'ci1', {
      quantity: 3,
    });
  });

  it('DELETE /cart/items/:id does not collide with DELETE /cart', async () => {
    cartService.removeItem.mockResolvedValue({
      cartId: 'c1',
      status: 'ACTIVE',
      items: [],
      total: 0,
    });
    cartService.clearCart.mockResolvedValue({ deleted: true });

    await request(app.getHttpServer())
      .delete('/cart/items/ci1')
      .set('x-test-user', JSON.stringify({ id: 'u1' }))
      .expect(200);
    expect(cartService.removeItem).toHaveBeenCalledWith('u1', 'ci1');
    expect(cartService.clearCart).not.toHaveBeenCalled();

    await request(app.getHttpServer())
      .delete('/cart')
      .set('x-test-user', JSON.stringify({ id: 'u1' }))
      .expect(200);
    expect(cartService.clearCart).toHaveBeenCalledWith('u1');
  });
});
