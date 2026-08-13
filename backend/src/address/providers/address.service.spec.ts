// address/address.service.spec.ts
import { ConflictException, NotFoundException } from '@nestjs/common';
import { AddressService } from './address.service';
import {
  AddressGeocoder,
  GeocodedAddress,
} from '../interfaces/address-geocoder.interface';

describe('AddressService', () => {
  let service: AddressService;
  let mockDb: any;
  let mockTx: any;
  let mockGeocoder: AddressGeocoder;

  beforeEach(() => {
    mockTx = {
      user: { findUnique: jest.fn(), update: jest.fn(), count: jest.fn() },
      address: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      order: { count: jest.fn() },
    };

    mockDb = {
      $transaction: jest.fn((cb: (tx: typeof mockTx) => unknown) => cb(mockTx)),
      address: { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn() },
    };

    mockGeocoder = { geocode: jest.fn() };

    service = new AddressService(mockDb, mockGeocoder);
  });

  const dto = {
    street: 'Av. Joao Ribeiro, 535',
    city: 'Sao Paulo',
    state: 'SP',
    postalCode: '01000-000',
    countryCode: 'BR',
  };

  const geocoded: GeocodedAddress = {
    street: 'Avenida Joao Ribeiro, 535',
    city: 'Sao Paulo',
    state: 'SP',
    postalCode: '01000000',
    countryCode: 'BR',
    latitude: -23.5505,
    longitude: -46.6333,
  };

  describe('addAddressForUser', () => {
    it('throws NotFoundException when the user does not exist', async () => {
      mockTx.user.findUnique.mockResolvedValue(null);

      await expect(service.addAddressForUser('user-1', dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ConflictException when the user already has an address', async () => {
      mockTx.user.findUnique.mockResolvedValue({ address_id: 'existing-addr' });

      await expect(service.addAddressForUser('user-1', dto)).rejects.toThrow(
        ConflictException,
      );
      // must fail before touching the address table at all
      expect(mockTx.address.create).not.toHaveBeenCalled();
    });

    it('creates a new address and links it to the user on success', async () => {
      mockTx.user.findUnique.mockResolvedValue({ address_id: null });
      mockTx.address.findUnique.mockResolvedValue(null); // no existing dedup match
      (mockGeocoder.geocode as jest.Mock).mockResolvedValue(geocoded);
      mockTx.address.create.mockResolvedValue({
        address_id: 'addr-1',
        ...geocoded,
        postal_code: geocoded.postalCode,
        country: geocoded.countryCode,
      });

      const result = await service.addAddressForUser('user-1', dto);

      expect(mockTx.address.create).toHaveBeenCalled();
      expect(mockTx.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { address_id: 'addr-1' },
      });
      expect(result.addressId).toBe('addr-1');
    });

    it('falls back to the raw DTO fields when the geocoder throws', async () => {
      mockTx.user.findUnique.mockResolvedValue({ address_id: null });
      mockTx.address.findUnique.mockResolvedValue(null);
      (mockGeocoder.geocode as jest.Mock).mockRejectedValue(
        new Error('network down'),
      );
      mockTx.address.create.mockResolvedValue({
        address_id: 'addr-1',
        street: dto.street,
        city: dto.city,
        state: dto.state,
        postal_code: dto.postalCode,
        country: dto.countryCode,
      });

      await service.addAddressForUser('user-1', dto);

      // the create call should carry the raw dto's fields, not a geocoded result
      const createCall = mockTx.address.create.mock.calls[0][0];
      expect(createCall.data.country).toBe(dto.countryCode);
    });

    it('reuses an existing address instead of creating a duplicate (dedup)', async () => {
      mockTx.user.findUnique.mockResolvedValue({ address_id: null });
      (mockGeocoder.geocode as jest.Mock).mockResolvedValue(geocoded);
      mockTx.address.findUnique.mockResolvedValue({
        address_id: 'existing-addr',
      }); // dedup hit

      const result = await service.addAddressForUser('user-1', dto);

      expect(mockTx.address.create).not.toHaveBeenCalled();
      expect(result.addressId).toBe('existing-addr');
    });

    it('recovers from a P2002 race by re-fetching the concurrently-created address', async () => {
      mockTx.user.findUnique.mockResolvedValue({ address_id: null });
      (mockGeocoder.geocode as jest.Mock).mockResolvedValue(geocoded);
      mockTx.address.findUnique.mockResolvedValue(null); // no match at first look
      mockTx.address.create.mockRejectedValue({ code: 'P2002' }); // another request beat us to it
      mockTx.address.findUniqueOrThrow.mockResolvedValue({
        address_id: 'won-the-race',
      });

      const result = await service.addAddressForUser('user-1', dto);

      expect(result.addressId).toBe('won-the-race');
    });
  });

  describe('updateAddressForUser', () => {
    const current = {
      address_id: 'addr-old',
      street: 'Rua A, 1',
      city: 'Sao Paulo',
      state: 'SP',
      postal_code: '01000000',
      country: 'BR',
    };

    it('throws NotFoundException when the user does not exist', async () => {
      mockTx.user.findUnique.mockResolvedValue(null);
      await expect(service.updateAddressForUser('user-1', {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when the user has no address to edit', async () => {
      mockTx.user.findUnique.mockResolvedValue({ address_id: null });
      await expect(service.updateAddressForUser('user-1', {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('clones on write: creates a new address and repoints the user, cleaning up the old one', async () => {
      mockTx.user.findUnique.mockResolvedValue({
        address_id: current.address_id,
      });
      mockTx.address.findUniqueOrThrow.mockResolvedValueOnce(current); // fetch current
      (mockGeocoder.geocode as jest.Mock).mockResolvedValue(geocoded);
      mockTx.address.findUnique.mockResolvedValue(null); // no dedup match for the new merged address
      mockTx.address.create.mockResolvedValue({
        address_id: 'addr-new',
        ...geocoded,
        postal_code: geocoded.postalCode,
        country: geocoded.countryCode,
      });
      mockTx.user.count.mockResolvedValue(0);
      mockTx.order.count.mockResolvedValue(0);

      await service.updateAddressForUser('user-1', {
        street: 'Avenida Joao Ribeiro, 535',
      });

      expect(mockTx.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { address_id: 'addr-new' },
      });
      // old address had zero remaining references — should be deleted
      expect(mockTx.address.delete).toHaveBeenCalledWith({
        where: { address_id: current.address_id },
      });
    });

    it('is a no-op when the merged, normalized result matches the current address', async () => {
      mockTx.user.findUnique.mockResolvedValue({
        address_id: current.address_id,
      });
      mockTx.address.findUniqueOrThrow.mockResolvedValueOnce(current);
      (mockGeocoder.geocode as jest.Mock).mockResolvedValue(null); // falls back to raw fields
      mockTx.address.findUnique.mockResolvedValue(current); // dedup finds itself

      await service.updateAddressForUser('user-1', {}); // no actual field changes

      expect(mockTx.user.update).not.toHaveBeenCalled();
      expect(mockTx.address.delete).not.toHaveBeenCalled();
    });

    it('does NOT delete the old address when other users/orders still reference it', async () => {
      mockTx.user.findUnique.mockResolvedValue({
        address_id: current.address_id,
      });
      mockTx.address.findUniqueOrThrow.mockResolvedValueOnce(current);
      (mockGeocoder.geocode as jest.Mock).mockResolvedValue(geocoded);
      mockTx.address.findUnique.mockResolvedValue(null);
      mockTx.address.create.mockResolvedValue({
        address_id: 'addr-new',
        ...geocoded,
        postal_code: geocoded.postalCode,
        country: geocoded.countryCode,
      });
      mockTx.user.count.mockResolvedValue(1); // someone else still lives at the old address

      await service.updateAddressForUser('user-1', { street: 'x' });

      expect(mockTx.address.delete).not.toHaveBeenCalled();
    });
  });

  describe('deleteAddressForUser', () => {
    it('throws NotFoundException when the user has no address', async () => {
      mockTx.user.findUnique.mockResolvedValue({ address_id: null });
      await expect(service.deleteAddressForUser('user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('unlinks the user and deletes the address when it becomes orphaned', async () => {
      mockTx.user.findUnique.mockResolvedValue({ address_id: 'addr-1' });
      mockTx.user.count.mockResolvedValue(0);
      mockTx.order.count.mockResolvedValue(0);

      await service.deleteAddressForUser('user-1');

      expect(mockTx.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { address_id: null },
      });
      expect(mockTx.address.delete).toHaveBeenCalledWith({
        where: { address_id: 'addr-1' },
      });
    });

    it('unlinks the user but keeps the address when an order still references it', async () => {
      mockTx.user.findUnique.mockResolvedValue({ address_id: 'addr-1' });
      mockTx.user.count.mockResolvedValue(0);
      mockTx.order.count.mockResolvedValue(1); // historical order still points at it

      await service.deleteAddressForUser('user-1');

      expect(mockTx.address.delete).not.toHaveBeenCalled();
    });
  });

  describe('getAddressById', () => {
    it('throws NotFoundException when no address matches', async () => {
      mockDb.address.findUnique.mockResolvedValue(null);
      await expect(service.getAddressById('missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns a mapped response DTO on success', async () => {
      mockDb.address.findUnique.mockResolvedValue({
        address_id: 'addr-1',
        street: 'Rua A',
        city: 'SP',
        state: 'SP',
        postal_code: '00000000',
        country: 'BR',
      });

      const result = await service.getAddressById('addr-1');
      expect(result.addressId).toBe('addr-1');
    });
  });
});
