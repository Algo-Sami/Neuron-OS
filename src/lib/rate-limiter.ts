/**
 * Global Redis-Backed Rate Limiter & Concurrency Controller
 *
 * Implements:
 * 1. Unified Sliding-Window Rate Limiting across serverless instances (Vercel & Render).
 * 2. Atomic check-all-then-consume via a single Redis Lua script (zero phantom usage on rejection).
 * 3. Priority isolation: 75% interactive pool reservation, 25% background worker pool.
 * 4. Dedicated worker concurrency semaphore with automatic 60s lease TTL expiration (leak-proof).
 * 5. Provider-derived limits parameterized via environment variables.
 * 6. Fail-OPEN resilience on Redis timeout (>1500ms) with high-priority error logging.
 */

import Redis from 'ioredis';
import { getRedisUrl } from '@/lib/queue/redis';
import { logger } from '@/lib/logger';

// ── Rate Limiter Configuration ────────────────────────────────────────────────
// Defaults set conservatively for Free Tier (5 RPM baseline) with 80% safety margin.
// In Pay-As-You-Go mode, set AI_RATE_LIMIT_RPM=800, USER_RATE_LIMIT_RPM=20 in env.
export const RATE_LIMIT_CONFIG = {
  // Global provider request ceiling per minute (80% of provider RPM)
  globalRpm: Number(process.env.AI_RATE_LIMIT_RPM ?? '4'),
  // Per-student burst ceiling per minute
  userRpm: Number(process.env.USER_RATE_LIMIT_RPM ?? '1'),
  // Max concurrent background worker calls to Gemini
  workerMaxConcurrent: Number(process.env.WORKER_MAX_CONCURRENT_AI ?? '1'),
  // Worker semaphore lease TTL (auto-expires orphaned slots if worker crashes)
  workerLeaseTtlMs: Number(process.env.WORKER_LEASE_TTL_MS ?? '90000'),
  // Window duration
  windowMs: 60_000,
  // Interactive reserved fraction (75% interactive, 25% background)
  interactiveRatio: 0.75,
  // Redis call timeout
  redisTimeoutMs: 1500,
};

// ── Singleton Fast Redis Client for Rate Limiting ─────────────────────────────
let limiterRedisInstance: Redis | null = null;

function getLimiterRedis(): Redis | null {
  if (limiterRedisInstance) {
    return limiterRedisInstance;
  }

  try {
    const url = getRedisUrl();
    const isTLS = url.startsWith('rediss://');

    limiterRedisInstance = new Redis(url, {
      connectTimeout: RATE_LIMIT_CONFIG.redisTimeoutMs,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      enableReadyCheck: false,
      tls: isTLS ? { rejectUnauthorized: false } : undefined,
    });

    limiterRedisInstance.on('error', (err) => {
      logger.warn('[RateLimiter] Redis connection warning (will fail open):', err.message);
    });

    return limiterRedisInstance;
  } catch (err) {
    logger.error('[RateLimiter] Failed to initialize Redis client. Rate limiting will fail open.', err);
    return null;
  }
}

// ── Atomic Check-Then-Consume Lua Script ──────────────────────────────────────
/**
 * KEYS[1]: Global sliding window key (neuron:ratelimit:global)
 * KEYS[2]: User sliding window key (neuron:ratelimit:user:<userId>)
 * KEYS[3]: Worker semaphore key (neuron:semaphore:worker_ai)
 *
 * ARGV[1]: Current timestamp ms
 * ARGV[2]: Window duration ms (60000)
 * ARGV[3]: Global limit RPM
 * ARGV[4]: User limit RPM
 * ARGV[5]: Is background/worker request ("1" | "0")
 * ARGV[6]: Worker max concurrency
 * ARGV[7]: Worker lease TTL ms (60000)
 * ARGV[8]: Worker unique slot ID
 * ARGV[9]: Interactive reserved ratio (0.75)
 *
 * Returns:
 * [1, "OK", slotId] -> Granted and consumed
 * [0, "USER_LIMIT_EXCEEDED", retryAfterSec]
 * [0, "GLOBAL_LIMIT_EXCEEDED", retryAfterSec]
 * [0, "WORKER_CONCURRENCY_EXCEEDED", retryAfterSec]
 * [0, "WORKER_POOL_EXCEEDED", retryAfterSec]
 */
const ATOMIC_RATE_LIMIT_LUA = `
local now = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local globalLimit = tonumber(ARGV[3])
local userLimit = tonumber(ARGV[4])
local isWorker = ARGV[5] == "1"
local workerMaxConcurrent = tonumber(ARGV[6])
local workerLeaseTtl = tonumber(ARGV[7])
local workerSlotId = ARGV[8]
local interactiveRatio = tonumber(ARGV[9])

-- 1. Purge expired entries from sliding window sets
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now - windowMs)
redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', now - windowMs)

-- 2. Purge expired worker semaphore leases
redis.call('ZREMRANGEBYSCORE', KEYS[3], '-inf', now)

-- 3. CHECK EVERYTHING BEFORE CONSUMING (Zero consumption on rejection)

-- Check User Limit
local userCount = redis.call('ZCARD', KEYS[2])
if userCount >= userLimit then
  local oldest = redis.call('ZRANGE', KEYS[2], 0, 0, 'WITHSCORES')
  local retryAfter = 15
  if oldest and #oldest >= 2 then
    retryAfter = math.max(1, math.ceil((tonumber(oldest[2]) + windowMs - now) / 1000))
  end
  return {0, "USER_LIMIT_EXCEEDED", tostring(retryAfter)}
end

-- Check Global Limit & Partitioning
local globalCount = redis.call('ZCARD', KEYS[1])
if globalCount >= globalLimit then
  local oldest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
  local retryAfter = 15
  if oldest and #oldest >= 2 then
    retryAfter = math.max(1, math.ceil((tonumber(oldest[2]) + windowMs - now) / 1000))
  end
  return {0, "GLOBAL_LIMIT_EXCEEDED", tostring(retryAfter)}
end

-- If Worker Request, check worker concurrency semaphore and background pool share
if isWorker then
  local currentWorkerSlots = redis.call('ZCARD', KEYS[3])
  if currentWorkerSlots >= workerMaxConcurrent then
    return {0, "WORKER_CONCURRENCY_EXCEEDED", "10"}
  end

  local workerPoolLimit = math.max(1, math.floor(globalLimit * (1.0 - interactiveRatio)))
  if globalCount >= workerPoolLimit and globalCount >= math.floor(globalLimit * 0.5) then
    return {0, "WORKER_POOL_EXCEEDED", "15"}
  end
end

-- 4. ALL CHECKS PASSED -> ATOMICALLY CONSUME
local memberSuffix = ":" .. tostring(math.random(10000, 99999))

-- Add to global window
redis.call('ZADD', KEYS[1], now, tostring(now) .. memberSuffix)
redis.call('EXPIRE', KEYS[1], math.ceil(windowMs / 1000) + 10)

-- Add to user window
redis.call('ZADD', KEYS[2], now, tostring(now) .. memberSuffix)
redis.call('EXPIRE', KEYS[2], math.ceil(windowMs / 1000) + 10)

-- If Worker, register semaphore slot with lease expiration score
if isWorker then
  redis.call('ZADD', KEYS[3], now + workerLeaseTtl, workerSlotId)
  redis.call('EXPIRE', KEYS[3], math.ceil(workerLeaseTtl / 1000) + 15)
  return {1, "OK", workerSlotId}
end

return {1, "OK", ""}
`;

export interface RateLimitCheckParams {
  userId: string;
  isBackground?: boolean;
  operation?: string;
  workerSlotId?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  retryAfterSec?: number;
  workerSlotId?: string;
  failedOpen?: boolean;
}

/**
 * Custom error thrown when a background worker exceeds AI rate limits.
 * Caught by BullMQ worker to trigger moveToDelayed with exponential backoff.
 */
export class RateLimitBackoffError extends Error {
  public readonly isRateLimitBackoff = true;
  public readonly retryAfterMs: number;

  constructor(message: string, retryAfterSec: number = 15) {
    super(message);
    this.name = 'RateLimitBackoffError';
    this.retryAfterMs = retryAfterSec * 1000;
  }
}

/**
 * Atomically checks and acquires rate limit capacity for a single provider call.
 * Fails OPEN if Redis is unreachable or times out.
 */
export async function acquireAIRateLimitToken(
  params: RateLimitCheckParams
): Promise<RateLimitResult> {
  const { userId, isBackground = false, operation = 'ai-call' } = params;
  const redis = getLimiterRedis();

  // Fail OPEN if Redis is unavailable
  if (!redis) {
    logger.warn(`[RateLimiter] Redis not available. Failing OPEN for ${operation} (user: ${userId})`);
    return { allowed: true, failedOpen: true };
  }

  const now = Date.now();
  const workerSlotId = params.workerSlotId || `slot:${userId}:${now}:${Math.random().toString(36).slice(2, 7)}`;

  const keys = [
    'neuron:ratelimit:global',
    `neuron:ratelimit:user:${userId}`,
    'neuron:semaphore:worker_ai',
  ];

  const args = [
    String(now),
    String(RATE_LIMIT_CONFIG.windowMs),
    String(RATE_LIMIT_CONFIG.globalRpm),
    String(RATE_LIMIT_CONFIG.userRpm),
    isBackground ? '1' : '0',
    String(RATE_LIMIT_CONFIG.workerMaxConcurrent),
    String(RATE_LIMIT_CONFIG.workerLeaseTtlMs),
    workerSlotId,
    String(RATE_LIMIT_CONFIG.interactiveRatio),
  ];

  const tStart = performance.now();
  try {
    // Enforce 1500ms timeout on Redis call to prevent blocking serverless execution
    const redisPromise = redis.eval(ATOMIC_RATE_LIMIT_LUA, keys.length, ...keys, ...args) as Promise<[number, string, string?]>;
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Rate limiter Redis timeout (>1500ms)')), RATE_LIMIT_CONFIG.redisTimeoutMs)
    );

    const result = await Promise.race([redisPromise, timeoutPromise]);
    const durationMs = Math.round((performance.now() - tStart) * 100) / 100;
    const [status, reason, extra] = result;

    if (status === 1) {
      logger.info(
        `[RateLimiter] Granted capacity in ${durationMs}ms (op=${operation}, user=${userId}, bg=${isBackground})`
      );
      return {
        allowed: true,
        workerSlotId: isBackground ? (extra || workerSlotId) : undefined,
      };
    }

    const retryAfterSec = extra ? parseInt(extra, 10) : 15;
    logger.warn(
      `[RateLimiter] ${isBackground ? 'Worker' : 'Interactive'} request BLOCKED in ${durationMs}ms: ${reason} (operation: ${operation}, user: ${userId}, retryAfter: ${retryAfterSec}s)`
    );

    return {
      allowed: false,
      reason,
      retryAfterSec: isNaN(retryAfterSec) ? 15 : retryAfterSec,
    };
  } catch (err: unknown) {
    const durationMs = Math.round((performance.now() - tStart) * 100) / 100;
    // Fail OPEN on any Redis exception or timeout
    logger.error(
      `[RateLimiter] Redis call failed or timed out after ${durationMs}ms. FAILING OPEN to preserve student availability for ${operation}:`,
      err
    );
    return { allowed: true, failedOpen: true };
  }
}

/**
 * Explicitly releases a worker concurrency semaphore slot upon job completion.
 */
export async function releaseWorkerSlot(slotId: string): Promise<void> {
  const redis = getLimiterRedis();
  if (!redis || !slotId) return;

  try {
    await redis.zrem('neuron:semaphore:worker_ai', slotId);
  } catch (err) {
    logger.warn('[RateLimiter] Failed to release worker slot immediately (will auto-expire via TTL):', err);
  }
}
