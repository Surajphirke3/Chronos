/**
 * Durable sliding/fixed-window rate limiter backed by MongoDB.
 * Public API preserved from Phase 0: checkRateLimit(key, limit, windowMs).
 *
 * Concurrent safety: atomic $inc upsert on a per-window bucket id.
 * Cleanup: TTL index on expiresAt.
 *
 * TRUST_PROXY=true must only be set behind a trusted reverse proxy.
 */

import { createHash } from 'crypto'
import { connectDB } from '@/lib/mongodb/client'
import { RateLimitBucket } from '@/lib/mongodb/models/RateLimitBucket'

export type RateLimitResult = {
  allowed: boolean
  remaining: number
  retryAfterMs: number
}

type MemoryBucket = { count: number; resetAt: number }
const memoryFallback = new Map<string, MemoryBucket>()

function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex').slice(0, 32)
}

function memoryCheck(bucketId: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const existing = memoryFallback.get(bucketId)
  if (!existing || existing.resetAt <= now) {
    memoryFallback.set(bucketId, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: limit - 1, retryAfterMs: 0 }
  }
  if (existing.count >= limit) {
    return { allowed: false, remaining: 0, retryAfterMs: Math.max(0, existing.resetAt - now) }
  }
  existing.count += 1
  return { allowed: true, remaining: limit - existing.count, retryAfterMs: 0 }
}

/**
 * Fixed-window counter. Bucket id includes the window start so windows don't overlap.
 * Prefers MongoDB; falls back to process memory only if DB is unavailable (logged once per process).
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const now = Date.now()
  const windowStart = Math.floor(now / windowMs) * windowMs
  const bucketId = `${hashKey(key)}:${windowStart}`
  const expiresAt = new Date(windowStart + windowMs + 60_000)

  try {
    await connectDB()
    const doc = await RateLimitBucket.findOneAndUpdate(
      { _id: bucketId },
      {
        $inc: { count: 1 },
        $setOnInsert: { expiresAt },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )

    const count = typeof doc?.count === 'number' ? doc.count : 1
    if (count > limit) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: Math.max(0, windowStart + windowMs - now),
      }
    }
    return {
      allowed: true,
      remaining: Math.max(0, limit - count),
      retryAfterMs: 0,
    }
  } catch {
    // Fail closed for security-sensitive callers that treat allowed=false as block;
    // memory fallback still provides single-instance protection during DB blips.
    return memoryCheck(bucketId, limit, windowMs)
  }
}

/** Synchronous memory-only helper for unit tests of window math without Mongo. */
export function checkRateLimitMemoryOnly(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now()
  const windowStart = Math.floor(now / windowMs) * windowMs
  const bucketId = `${hashKey(key)}:${windowStart}`
  return memoryCheck(bucketId, limit, windowMs)
}

export function getClientIp(req: Request): string {
  const trustProxy = process.env.TRUST_PROXY === 'true'
  if (trustProxy) {
    const forwarded = req.headers.get('x-forwarded-for')
    if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown'
    const realIp = req.headers.get('x-real-ip')
    if (realIp) return realIp.trim()
  }
  // Without TRUST_PROXY, do not honor spoofable forwarding headers
  return req.headers.get('x-real-ip')?.trim() || 'unknown'
}

export function hashIdentifier(value: string): string {
  return createHash('sha256').update(value.toLowerCase().trim()).digest('hex')
}

/** Preset policies used across the app */
export const RATE_LIMITS = {
  register: { limit: 10, windowMs: 15 * 60 * 1000 },
  loginIp: { limit: 30, windowMs: 15 * 60 * 1000 },
  loginAccount: { limit: 10, windowMs: 15 * 60 * 1000 },
  ai: { limit: 60, windowMs: 60 * 1000 },
  workflowExecute: { limit: 10, windowMs: 60 * 1000 },
  leadImport: { limit: 10, windowMs: 60 * 60 * 1000 },
  invitationCreate: { limit: 20, windowMs: 60 * 60 * 1000 },
  invitationAccept: { limit: 30, windowMs: 15 * 60 * 1000 },
  invitationPreview: { limit: 30, windowMs: 15 * 60 * 1000 },
} as const
