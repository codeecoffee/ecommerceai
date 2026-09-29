import { CacheService } from './cache.service';

function createRedisMock() {
  return {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  } as any;
}

describe('CacheService', () => {
  describe('get', () => {
    it('parses and returns a hit', async () => {
      const redis = createRedisMock();
      redis.get.mockResolvedValue(JSON.stringify({ id: 'p1', name: 'Widget' }));
      const service = new CacheService(redis);

      const result = await service.get('product:p1');
      expect(result).toEqual({ id: 'p1', name: 'Widget' });
    });

    it('returns null on a miss', async () => {
      const redis = createRedisMock();
      redis.get.mockResolvedValue(null);
      const service = new CacheService(redis);

      expect(await service.get('product:missing')).toBeNull();
    });

    it('returns null (not a thrown error) when Redis itself fails', async () => {
      const redis = createRedisMock();
      redis.get.mockRejectedValue(new Error('ECONNREFUSED'));
      const service = new CacheService(redis);

      await expect(service.get('product:p1')).resolves.toBeNull();
    });
  });

  describe('set', () => {
    it('serializes the value with the given TTL', async () => {
      const redis = createRedisMock();
      const service = new CacheService(redis);

      await service.set('product:p1', { id: 'p1' }, 300);

      expect(redis.set).toHaveBeenCalledWith(
        'product:p1',
        JSON.stringify({ id: 'p1' }),
        'EX',
        300,
      );
    });

    it('does not throw when Redis fails to write', async () => {
      const redis = createRedisMock();
      redis.set.mockRejectedValue(new Error('ECONNREFUSED'));
      const service = new CacheService(redis);

      await expect(service.set('product:p1', {}, 300)).resolves.toBeUndefined();
    });
  });

  describe('del', () => {
    it('deletes the key', async () => {
      const redis = createRedisMock();
      const service = new CacheService(redis);

      await service.del('product:p1');
      expect(redis.del).toHaveBeenCalledWith('product:p1');
    });

    it('does not throw when Redis fails to delete', async () => {
      const redis = createRedisMock();
      redis.del.mockRejectedValue(new Error('ECONNREFUSED'));
      const service = new CacheService(redis);

      await expect(service.del('product:p1')).resolves.toBeUndefined();
    });
  });
});
