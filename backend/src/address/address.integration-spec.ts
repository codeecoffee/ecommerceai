// address/address.integration-spec.ts
import { Test } from '@nestjs/testing';
import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import request from 'supertest';
import { AddressController } from './address.controller';
import { AddressService } from './providers/address.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { OwnershipOrAdminGuard } from '../auth/guards/ownership-or-admin.guard';

describe('AddressController (integration)', () => {
  let app: INestApplication;
  const mockAddressService = {
    addAddressForUser: jest.fn(),
    updateAddressForUser: jest.fn(),
    deleteAddressForUser: jest.fn(),
    getAddresses: jest.fn(),
    getAddressById: jest.fn(),
  };

  const fakeUser = { id: 'user-1', role: 'USER' };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AddressController],
      providers: [{ provide: AddressService, useValue: mockAddressService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: ExecutionContext) => {
          ctx.switchToHttp().getRequest().user = fakeUser;
          return true;
        },
      })
      // Guard logic itself (ownership resolution, role checks) has its own unit
      // tests — here we only care that routes are wired to the right decorators.
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(OwnershipOrAdminGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterEach(() => jest.clearAllMocks());
  afterAll(async () => app.close());

  it('POST /address resolves the userId from the JWT, not the request body', async () => {
    mockAddressService.addAddressForUser.mockResolvedValue({
      addressId: 'addr-1',
    });

    await request(app.getHttpServer())
      .post('/address')
      .send({
        street: 'Rua A, 1',
        city: 'SP',
        state: 'SP',
        postalCode: '00000000',
        countryCode: 'BR',
      })
      .expect(201);

    // this is the exact class of bug the project caught before with @Query vs @CurrentUser —
    // only a real HTTP pass through Nest's param resolution can prove this
    expect(mockAddressService.addAddressForUser).toHaveBeenCalledWith(
      'user-1',
      expect.any(Object),
    );
  });

  it('POST /address rejects an invalid countryCode before reaching the service', async () => {
    await request(app.getHttpServer())
      .post('/address')
      .send({
        street: 'Rua A, 1',
        city: 'SP',
        state: 'SP',
        postalCode: '00000000',
        countryCode: 'brazil',
      })
      .expect(400);

    expect(mockAddressService.addAddressForUser).not.toHaveBeenCalled();
  });

  it('POST /address/user/:userId resolves the target user from the URL param, not the caller', async () => {
    mockAddressService.addAddressForUser.mockResolvedValue({
      addressId: 'addr-1',
    });

    await request(app.getHttpServer())
      .post('/address/user/11111111-1111-1111-1111-111111111111')
      .send({
        street: 'Rua A, 1',
        city: 'SP',
        state: 'SP',
        postalCode: '00000000',
        countryCode: 'BR',
      })
      .expect(201);

    expect(mockAddressService.addAddressForUser).toHaveBeenCalledWith(
      '11111111-1111-1111-1111-111111111111',
      expect.any(Object),
    );
  });

  it('POST /address/user/:userId rejects a non-UUID param', async () => {
    await request(app.getHttpServer())
      .post('/address/user/not-a-uuid')
      .send({
        street: 'x',
        city: 'x',
        state: 'x',
        postalCode: '00000000',
        countryCode: 'BR',
      })
      .expect(400);
  });

  it('GET /address/:id rejects a malformed UUID via the param DTO', async () => {
    await request(app.getHttpServer()).get('/address/not-a-uuid').expect(400);

    expect(mockAddressService.getAddressById).not.toHaveBeenCalled();
  });

  it('GET /address/:id passes the validated id through to the service', async () => {
    mockAddressService.getAddressById.mockResolvedValue({
      addressId: '11111111-1111-1111-1111-111111111111',
    });

    await request(app.getHttpServer())
      .get('/address/11111111-1111-1111-1111-111111111111')
      .expect(200);

    expect(mockAddressService.getAddressById).toHaveBeenCalledWith(
      '11111111-1111-1111-1111-111111111111',
    );
  });

  it('DELETE /address/me resolves the caller from the JWT and returns no body', async () => {
    await request(app.getHttpServer()).delete('/address/me').expect(200); // adjust to 204 if you set that status explicitly on the route

    expect(mockAddressService.deleteAddressForUser).toHaveBeenCalledWith(
      'user-1',
    );
  });
});
