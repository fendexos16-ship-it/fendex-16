
import { CacheEntry } from '../types';

const CACHE_STORE: Record<string, CacheEntry<any>> = {};

let hitCount = 0;
let missCount = 0;

export const cacheService = {
  
  get: <T>(key: string): T | null => {
    const entry = CACHE_STORE[key];
    if (!entry) {
      missCount++;
      return null;
    }
    
    if (Date.now() > entry.expiresAt) {
      delete CACHE_STORE[key];
      missCount++;
      return null;
    }

    hitCount++;
    return entry.data;
  },

  set: <T>(key: string, data: T, ttlSeconds: number): void => {
    CACHE_STORE[key] = {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + (ttlSeconds * 1000)
    };
  },

  invalidate: (keyPattern: string): void => {
    // Basic regex or prefix matching
    const regex = new RegExp(keyPattern);
    Object.keys(CACHE_STORE).forEach(key => {
       if (regex.test(key)) delete CACHE_STORE[key];
    });
  },

  flush: (): void => {
    Object.keys(CACHE_STORE).forEach(key => delete CACHE_STORE[key]);
    hitCount = 0;
    missCount = 0;
  },

  getStats: () => {
    const total = hitCount + missCount;
    const rate = total > 0 ? (hitCount / total) * 100 : 0;
    return {
      hitCount,
      missCount,
      hitRate: rate,
      keys: Object.keys(CACHE_STORE).length
    };
  }
};
