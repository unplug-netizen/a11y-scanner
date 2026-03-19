import Redis from 'ioredis';
import { ScanResult } from '@/types';

// Redis client configuration
const REDIS_URL = process.env.REDIS_URL;
const REDIS_TOKEN = process.env.REDIS_TOKEN;

// Cache TTL in seconds
const CACHE_TTL = {
  quick: 60 * 60,      // 1 hour for quick scans
  deep: 60 * 60 * 4,   // 4 hours for deep scans
};

// Redis client instance
let redisClient: Redis | null = null;

/**
 * Get or create Redis client
 */
export function getRedisClient(): Redis | null {
  if (redisClient) return redisClient;
  
  if (!REDIS_URL) {
    console.log('[Redis] No REDIS_URL configured, caching disabled');
    return null;
  }

  try {
    redisClient = new Redis(REDIS_URL, {
      ...(REDIS_TOKEN ? { password: REDIS_TOKEN } : {}),
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
    });

    redisClient.on('error', (err) => {
      console.error('[Redis] Connection error:', err.message);
    });

    redisClient.on('connect', () => {
      console.log('[Redis] Connected');
    });

    return redisClient;
  } catch (error) {
    console.error('[Redis] Failed to create client:', error);
    return null;
  }
}

/**
 * Generate cache key for a scan
 */
export function generateCacheKey(url: string, mode: 'quick' | 'deep'): string {
  // Normalize URL for consistent caching
  const normalizedUrl = url.toLowerCase().replace(/\/$/, '');
  const hash = Buffer.from(normalizedUrl).toString('base64url');
  return `a11y:scan:${mode}:${hash}`;
}

/**
 * Get cached scan result
 */
export async function getCachedScan(
  url: string, 
  mode: 'quick' | 'deep'
): Promise<{ result: ScanResult; cachedAt: string; ttl: number } | null> {
  const redis = getRedisClient();
  if (!redis) return null;

  try {
    const key = generateCacheKey(url, mode);
    const cached = await redis.get(key);

    if (!cached) return null;

    const ttl = await redis.ttl(key);
    const data = JSON.parse(cached);

    return {
      result: data.result,
      cachedAt: data.cachedAt,
      ttl,
    };
  } catch (error) {
    console.error('[Redis] Get cache error:', error);
    return null;
  }
}

/**
 * Cache scan result
 */
export async function cacheScanResult(
  url: string,
  mode: 'quick' | 'deep',
  result: ScanResult
): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    const key = generateCacheKey(url, mode);
    const ttl = CACHE_TTL[mode];

    const data = {
      result,
      cachedAt: new Date().toISOString(),
    };

    await redis.setex(key, ttl, JSON.stringify(data));
    console.log(`[Redis] Cached scan result: ${key} (TTL: ${ttl}s)`);
  } catch (error) {
    console.error('[Redis] Cache error:', error);
  }
}

/**
 * Invalidate cached scan result
 */
export async function invalidateScanCache(
  url: string,
  mode?: 'quick' | 'deep'
): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    if (mode) {
      const key = generateCacheKey(url, mode);
      await redis.del(key);
    } else {
      // Invalidate both modes
      const quickKey = generateCacheKey(url, 'quick');
      const deepKey = generateCacheKey(url, 'deep');
      await redis.del(quickKey, deepKey);
    }
  } catch (error) {
    console.error('[Redis] Invalidate cache error:', error);
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  isConnected: boolean;
  keys: number;
  memory?: string;
} | null> {
  const redis = getRedisClient();
  if (!redis) return null;

  try {
    const info = await redis.info('memory');
    const keys = await redis.keys('a11y:scan:*');
    
    const memoryMatch = info.match(/used_memory_human:(.+)/);
    const memory = memoryMatch ? memoryMatch[1].trim() : undefined;

    return {
      isConnected: redis.status === 'ready',
      keys: keys.length,
      memory,
    };
  } catch (error) {
    console.error('[Redis] Stats error:', error);
    return null;
  }
}

/**
 * Clear all scan cache
 */
export async function clearScanCache(): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    const keys = await redis.keys('a11y:scan:*');
    if (keys.length > 0) {
      await redis.del(...keys);
      console.log(`[Redis] Cleared ${keys.length} cached scans`);
    }
  } catch (error) {
    console.error('[Redis] Clear cache error:', error);
  }
}

/**
 * Check if caching is available
 */
export function isCacheAvailable(): boolean {
  return !!getRedisClient();
}

/**
 * Close Redis connection
 */
export async function closeRedisConnection(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    console.log('[Redis] Connection closed');
  }
}
