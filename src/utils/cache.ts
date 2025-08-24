import NodeCache from 'node-cache';
import { createHash } from 'crypto';
import { CacheEntry } from '../types';
import logger from './logger';

export class CacheManager {
  private memoryCache: NodeCache;
  private hitCount = 0;
  private missCount = 0;

  constructor(options: { stdTTL?: number; checkperiod?: number; maxKeys?: number } = {}) {
    this.memoryCache = new NodeCache({
      stdTTL: options.stdTTL || 3600, // 1 hour default TTL
      checkperiod: options.checkperiod || 600, // 10 minutes check period
      maxKeys: options.maxKeys || 1000,
      useClones: false // Performance optimization
    });

    // Listen for cache events
    this.memoryCache.on('expired', (key, value) => {
      logger.debug(`Cache key expired: ${key}`);
    });

    this.memoryCache.on('del', (key, value) => {
      logger.debug(`Cache key deleted: ${key}`);
    });
  }

  /**
   * Generate cache key
   */
  generateKey(prefix: string, data: any): string {
    const hash = createHash('sha256')
      .update(JSON.stringify(data))
      .digest('hex')
      .substring(0, 16);
    return `${prefix}:${hash}`;
  }

  /**
   * Get cache
   */
  get<T>(key: string): T | null {
    const value = this.memoryCache.get<T>(key);
    if (value !== undefined) {
      this.hitCount++;
      logger.debug(`Cache hit: ${key}`);
      return value;
    } else {
      this.missCount++;
      logger.debug(`Cache miss: ${key}`);
      return null;
    }
  }

  /**
   * Set cache
   */
  set<T>(key: string, value: T, ttl?: number): boolean {
    const success = this.memoryCache.set(key, value, ttl || 0);
    if (success) {
      logger.debug(`Cache set: ${key}`);
    }
    return success;
  }

  /**
   * Delete cache
   */
  del(key: string): number {
    return this.memoryCache.del(key);
  }

  /**
   * Clear cache
   */
  flush(): void {
    this.memoryCache.flushAll();
    this.hitCount = 0;
    this.missCount = 0;
    logger.info('Cache flushed');
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const keys = this.memoryCache.keys();
    const hitRate = this.hitCount + this.missCount > 0
      ? this.hitCount / (this.hitCount + this.missCount)
      : 0;

    return {
      keys: keys.length,
      hits: this.hitCount,
      misses: this.missCount,
      hitRate: Math.round(hitRate * 100) / 100,
      memoryUsage: process.memoryUsage()
    };
  }

  /**
   * Check if key exists
   */
  has(key: string): boolean {
    return this.memoryCache.has(key);
  }

  /**
   * Get all keys
   */
  keys(): string[] {
    return this.memoryCache.keys();
  }
}

// Global cache instance
export const globalCache = new CacheManager({
  stdTTL: 3600, // 1 hour
  maxKeys: 1000
});