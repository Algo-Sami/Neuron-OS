/**
 * Phase 1: Redis Connection Manager
 *
 * Creates and manages a single ioredis connection for BullMQ.
 * Supports standard Redis (redis://) and TLS Redis (rediss://) — compatible
 * with local Redis, Upstash, Redis Cloud, AWS ElastiCache, and GCP Memorystore.
 *
 * SECURITY: Redis connection details must remain server-side only.
 * This module must never be imported by browser/client bundles.
 */

import Redis from 'ioredis';
import { logger } from '@/lib/logger';

// Singleton connection instance — reused across queue and worker
let redisInstance: Redis | null = null;

function getRedisUrl(): string {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error(
      '[Redis] REDIS_URL environment variable is not set. ' +
      'Set REDIS_URL=redis://127.0.0.1:6379 for local development or ' +
      'a hosted Redis URL (rediss://...) for production.'
    );
  }
  return url;
}

/**
 * Returns the shared Redis connection, creating it on first call.
 * Safe to call multiple times — always returns the same instance.
 */
export function getRedisConnection(): Redis {
  if (redisInstance && redisInstance.status !== 'end' && redisInstance.status !== 'close') {
    return redisInstance;
  }

  const url = getRedisUrl();
  const isTLS = url.startsWith('rediss://');

  logger.info(`[Redis] Connecting to Redis (TLS: ${isTLS})`);

  redisInstance = new Redis(url, {
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false,   // Required by BullMQ
    tls: isTLS ? {} : undefined,
    retryStrategy(times) {
      const maxDelay = 30_000;
      const delay = Math.min(2 ** times * 200, maxDelay);
      logger.warn(`[Redis] Reconnect attempt ${times}, retry in ${delay}ms`);
      return delay;
    },
    reconnectOnError(err) {
      const targetErrors = ['READONLY', 'ECONNRESET'];
      if (targetErrors.some((e) => err.message.includes(e))) {
        return true;
      }
      return false;
    },
  });

  redisInstance.on('connect', () => logger.info('[Redis] Connection established'));
  redisInstance.on('ready', () => logger.info('[Redis] Ready'));
  redisInstance.on('error', (err) => logger.error('[Redis] Connection error:', err));
  redisInstance.on('close', () => logger.warn('[Redis] Connection closed'));
  redisInstance.on('reconnecting', () => logger.warn('[Redis] Reconnecting...'));

  return redisInstance;
}

/**
 * Gracefully disconnect Redis. Should be called during worker shutdown.
 */
export async function closeRedisConnection(): Promise<void> {
  if (redisInstance) {
    logger.info('[Redis] Closing connection gracefully');
    await redisInstance.quit();
    redisInstance = null;
  }
}

/**
 * Returns a dedicated Redis connection for BullMQ Worker subscriber.
 * BullMQ requires a separate dedicated connection for the blocking subscriber
 * so we create a fresh instance here (not the shared one).
 */
export function createDedicatedRedisConnection(): Redis {
  const url = getRedisUrl();
  const isTLS = url.startsWith('rediss://');

  return new Redis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    tls: isTLS ? {} : undefined,
    retryStrategy(times) {
      const maxDelay = 30_000;
      return Math.min(2 ** times * 200, maxDelay);
    },
  });
}
