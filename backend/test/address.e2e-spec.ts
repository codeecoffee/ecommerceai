// test/address.e2e-spec.ts
import { Test } from '@nestjs/testing';
import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import request from 'supertest';
import { AddressModule } from '../src/address/address.module';
import { DatabaseService } from '../src/database/providers/database.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { ADDRESS_GEOCODER } from '../src/address/interfaces/address-geocoder.token';
import { AddressGeocoder } from '../src/address/interfaces/address-geocoder.interface';

describe('Address (e2e)', () => {
  let app: INestApplication;
  let db: DatabaseService;

  // Deterministic stand-in for Photon — same reasoning as mocking any other
  // third-party network call in a test that's meant to check YOUR code
  const fakeGeocoder: AddressGeocoder = {
    geocode: jest.fn().mockResolvedValue(null), // forces the raw-input fallback path by default
  };

  let userAId: string;
  let userBId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AddressModule],
    })
      .overrideProvider(ADDRESS_GEOCODER)
      .useValue(fakeGeocoder)
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: ExecutionContext) => {
          const req = ctx.switchToHttp().getRequest();
          // lets each test pick which user is "logged in" via a header
          req.user = { id: req.headers['x-test-user-id'], role: 'USER' };
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    db = moduleRef.get(DatabaseService);
  });

  beforeEach(async () => {
    // Clean slate per test — order matters if FKs are RESTRICT rather than CASCADE
    await db.address.deleteMany({});
    await db.user.deleteMany({
      where: { email: { contains: '@e2e-test.com' } },
    });

    const [userA, userB] = await Promise.all([
      db.user.create({
        data: {
          email: 'a@e2e-test.com',
          first_name: 'A' /* ...whatever else is required */,
        },
      }),
      db.user.create({ data: { email: 'b@e2e-test.com', first_name: 'B' } }),
    ]);
    userAId = userA.id;
    userBId = userB.id;
  });

  afterAll(async () => {
    await db.address.deleteMany({});
    await db.user.deleteMany({
      where: { email: { contains: '@e2e-test.com' } },
    });
    await app.close();
  });

  it('creates a real row in Postgres and links the user via a real FK update', async () => {
    const res = await request(app.getHttpServer())
      .post('/address')
      .set('x-test-user-id', userAId)
      .send({
        street: 'Rua A, 1',
        city: 'SP',
        state: 'SP',
        postalCode: '00000000',
        countryCode: 'BR',
      })
      .expect(201);

    const userRow = await db.user.findUnique({ where: { id: userAId } });
    expect(userRow?.address_id).toBe(res.body.addressId);
  });

  it('enforces normalized_key uniqueness at the DB level: two users at the same address share ONE row', async () => {
    const sameAddress = {
      street: 'Rua A, 1',
      city: 'SP',
      state: 'SP',
      postalCode: '00000000',
      countryCode: 'BR',
    };

    const resA = await request(app.getHttpServer())
      .post('/address')
      .set('x-test-user-id', userAId)
      .send(sameAddress)
      .expect(201);
    const resB = await request(app.getHttpServer())
      .post('/address')
      .set('x-test-user-id', userBId)
      .send(sameAddress)
      .expect(201);

    expect(resA.body.addressId).toBe(resB.body.addressId); // same row, not a duplicate

    const count = await db.address.count({});
    expect(count).toBe(1); // this is the real assertion mocks can't give you confidence in
  });

  it('orphan cleanup actually deletes the row when the last user detaches', async () => {
    const created = await request(app.getHttpServer())
      .post('/address')
      .set('x-test-user-id', userAId)
      .send({
        street: 'Rua B, 2',
        city: 'SP',
        state: 'SP',
        postalCode: '00000000',
        countryCode: 'BR',
      })
      .expect(201);

    await request(app.getHttpServer())
      .delete('/address/me')
      .set('x-test-user-id', userAId)
      .expect(200);

    const row = await db.address.findUnique({
      where: { address_id: created.body.addressId },
    });
    expect(row).toBeNull(); // gone from the real table, not just unlinked
  });

  it('keeps the row alive when a second user still references it after the first deletes', async () => {
    const sameAddress = {
      street: 'Rua C, 3',
      city: 'SP',
      state: 'SP',
      postalCode: '00000000',
      countryCode: 'BR',
    };

    const created = await request(app.getHttpServer())
      .post('/address')
      .set('x-test-user-id', userAId)
      .send(sameAddress)
      .expect(201);
    await request(app.getHttpServer())
      .post('/address')
      .set('x-test-user-id', userBId)
      .send(sameAddress)
      .expect(201);

    await request(app.getHttpServer())
      .delete('/address/me')
      .set('x-test-user-id', userAId)
      .expect(200);

    const row = await db.address.findUnique({
      where: { address_id: created.body.addressId },
    });
    expect(row).not.toBeNull(); // userB still lives there
  });

  it('clone-on-write: editing creates a second real row and leaves the first untouched for other residents', async () => {
    const original = {
      street: 'Rua D, 4',
      city: 'SP',
      state: 'SP',
      postalCode: '00000000',
      countryCode: 'BR',
    };

    const created = await request(app.getHttpServer())
      .post('/address')
      .set('x-test-user-id', userAId)
      .send(original)
      .expect(201);
    await request(app.getHttpServer())
      .post('/address')
      .set('x-test-user-id', userBId)
      .send(original)
      .expect(201); // B shares A's address

    const updated = await request(app.getHttpServer())
      .patch('/address/me')
      .set('x-test-user-id', userAId)
      .send({ street: 'Rua D, 4-A' })
      .expect(200);

    expect(updated.body.addressId).not.toBe(created.body.addressId);

    const originalRow = await db.address.findUnique({
      where: { address_id: created.body.addressId },
    });
    expect(originalRow).not.toBeNull(); // still alive — userB is still there
  });
});
