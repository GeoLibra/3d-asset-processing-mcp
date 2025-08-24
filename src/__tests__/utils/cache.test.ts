import { CacheManager } from '../../utils/cache';

describe('CacheManager', () => {
  let cacheManager: any;

  beforeEach(() => {
    cacheManager = new CacheManager({
      stdTTL: 60, // 1 minute for tests
      maxKeys: 100
    });
  });

  test('should set and get cache values', () => {
    const key = 'test-key';
    const value = { data: 'test-value' };

    cacheManager.set(key, value);
    const result = cacheManager.get(key);

    expect(result).toEqual(value);
  });

  test('should generate consistent cache keys', () => {
    const prefix = 'test';
    const data = { id: 123, name: 'test-data' };

    const key1 = cacheManager.generateKey(prefix, data);
    const key2 = cacheManager.generateKey(prefix, data);

    expect(key1).toBe(key2);
  });

  test('should return null for non-existent keys', () => {
    const key = 'non-existent-key';
    const result = cacheManager.get(key);

    expect(result).toBeNull();
  });

  test('should delete cache entries', () => {
    const key = 'delete-test-key';
    const value = { data: 'delete-test-value' };

    cacheManager.set(key, value);
    expect(cacheManager.get(key)).toEqual(value);

    cacheManager.del(key);
    expect(cacheManager.get(key)).toBeNull();
  });

  test('should check if key exists', () => {
    const key = 'exists-test-key';
    const value = { data: 'exists-test-value' };

    expect(cacheManager.has(key)).toBe(false);

    cacheManager.set(key, value);
    expect(cacheManager.has(key)).toBe(true);
  });

  test('should flush all cache entries', () => {
    const keys = ['flush-1', 'flush-2', 'flush-3'];
    const value = { data: 'flush-test-value' };

    keys.forEach(key => cacheManager.set(key, value));
    keys.forEach(key => expect(cacheManager.has(key)).toBe(true));

    cacheManager.flush();
    keys.forEach(key => expect(cacheManager.has(key)).toBe(false));
  });

  test('should return cache statistics', () => {
    const stats = cacheManager.getStats();

    expect(stats).toHaveProperty('keys');
    expect(stats).toHaveProperty('hits');
    expect(stats).toHaveProperty('misses');
    expect(stats).toHaveProperty('hitRate');
    expect(stats).toHaveProperty('memoryUsage');
  });
});