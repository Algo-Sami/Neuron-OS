/**
 * Phase 1: Redis Connection Manager
 *
 * Creates and manages a single ioredis connection for BullMQ.
 * Supports standard Redis (redis://) and TLS Redis (rediss://) — compatible
 * with local Redis, Railway, Upstash, Redis Cloud, AWS ElastiCache, and GCP Memorystore.
 *
 * SECURITY: Redis connection details must remain server-side only.
 * This module must never be imported by browser/client bundles.
 */

import Redis, { type RedisOptions } from 'ioredis';
import { logger } from '@/lib/logger';

// Singleton connection instance — reused across queue and worker
let redisInstance: Redis | null = null;

export function getRedisUrl(): string {
  // Check standard and Railway/Vercel/Cloud-specific environment variables
  const url =
    process.env.REDIS_URL ||
    process.env.REDIS_PRIVATE_URL ||
    process.env.REDIS_PUBLIC_URL ||
    process.env.KV_URL;

  if (url) {
    return url;
  }

  // Check separate Railway/Docker host variables
  const host = process.env.REDISHOST || process.env.REDIS_HOST;
  const port = process.env.REDISPORT || process.env.REDIS_PORT || '6379';
  const password = process.env.REDISPASSWORD || process.env.REDIS_PASSWORD;
  const user = process.env.REDISUSER || process.env.REDIS_USER || 'default';

  if (host) {
    if (password) {
      return `redis://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}`;
    }
    return `redis://${host}:${port}`;
  }

  throw new Error(
    '[Redis] No Redis environment variables found. ' +
    'Set REDIS_URL (or REDIS_PRIVATE_URL / REDISHOST) for Railway / cloud deployments, ' +
    'or REDIS_URL=redis://127.0.0.1:6379 for local development.'
  );
}

function getRedisOptions(isDedicated: boolean = false): RedisOptions {
  const url = getRedisUrl();
  const isTLS = url.startsWith('rediss://');

  return {
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false,   // Required by BullMQ
    family: 4,                 // Force IPv4 for reliable container networking
    connectTimeout: 20000,     // 20s connection timeout
    tls: isTLS
      ? {
          rejectUnauthorized: false, // Prevents TLS handshake failure on hosted cloud certs
        }
      : undefined,
    retryStrategy(times) {
      const maxDelay = 30_000;
      const delay = Math.min(2 ** times * 200, maxDelay);
      logger.warn(`[Redis] Reconnect attempt ${times} (dedicated=${isDedicated}), retrying in ${delay}ms`);
      return delay;
    },
    reconnectOnError(err) {
      const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT'];
      if (targetErrors.some((e) => err.message.includes(e))) {
        return true;
      }
      return false;
    },
  };
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
  const safeHost = url.split('@').pop() || 'localhost';

  logger.info(`[Redis] Connecting shared client to Redis -> ${safeHost} (TLS: ${isTLS})`);

  redisInstance = new Redis(url, getRedisOptions(false));

  redisInstance.on('connect', () => logger.info('[Redis] Shared connection established'));
  redisInstance.on('ready', () => logger.info('[Redis] Shared client is Ready'));
  redisInstance.on('error', (err) => logger.error('[Redis] Shared connection error:', err));
  redisInstance.on('close', () => logger.warn('[Redis] Shared connection closed'));
  redisInstance.on('reconnecting', () => logger.warn('[Redis] Shared connection reconnecting...'));

  return redisInstance;
}

/**
 * Gracefully disconnect Redis. Should be called during worker shutdown.
 */
export async function closeRedisConnection(): Promise<void> {
  if (redisInstance) {
    logger.info('[Redis] Closing shared connection gracefully');
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
  const safeHost = url.split('@').pop() || 'localhost';

  logger.info(`[Redis] Creating dedicated worker subscriber connection -> ${safeHost} (TLS: ${isTLS})`);

  const client = new Redis(url, getRedisOptions(true));

  client.on('connect', () => logger.info('[Redis] Dedicated worker connection established'));
  client.on('ready', () => logger.info('[Redis] Dedicated worker client is Ready'));
  client.on('error', (err) => logger.error('[Redis] Dedicated worker connection error:', err));
  client.on('close', () => logger.warn('[Redis] Dedicated worker connection closed'));
  client.on('reconnecting', () => logger.warn('[Redis] Dedicated worker connection reconnecting...'));

  return client;
}

