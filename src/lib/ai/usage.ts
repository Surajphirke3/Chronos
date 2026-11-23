import { connectDB } from '@/lib/mongodb/client'
import { AiUsageEvent } from '@/lib/mongodb/models/AiUsageEvent'
import { checkRateLimit, RATE_LIMITS } from '@/lib/security/rateLimit'

export type AiUsageOutcome = 'success' | 'error' | 'rejected'

function dayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10)
}

export function getAiDailyQuota(): number {
  const raw = process.env.AI_USER_DAILY_REQUEST_QUOTA
  const n = raw ? parseInt(raw, 10) : 200
  return Number.isFinite(n) && n > 0 ? n : 200
}

/** Per-user rate limit + daily quota gate for AI endpoints. */
export async function assertAiBudget(userId: string): Promise<
  { ok: true } | { ok: false; status: number; error: string }
> {
  const rate = await checkRateLimit(
    `ai:${userId}`,
    RATE_LIMITS.ai.limit,
    RATE_LIMITS.ai.windowMs
  )
  if (!rate.allowed) {
    return { ok: false, status: 429, error: 'AI rate limit exceeded. Try again shortly.' }
  }

  await connectDB()
  const used = await AiUsageEvent.countDocuments({
    userId,
    day: dayKey(),
    outcome: 'success',
  })
  if (used >= getAiDailyQuota()) {
    return {
      ok: false,
      status: 429,
      error: 'Daily AI request quota exceeded.',
    }
  }

  return { ok: true }
}

export async function recordAiUsage(params: {
  userId: string
  provider: string
  model?: string
  route: string
  outcome: AiUsageOutcome
  promptTokens?: number
  completionTokens?: number
}): Promise<void> {
  try {
    await connectDB()
    await AiUsageEvent.create({
      userId: params.userId,
      provider: params.provider,
      model: params.model || '',
      route: params.route,
      outcome: params.outcome,
      promptTokens: params.promptTokens || 0,
      completionTokens: params.completionTokens || 0,
      day: dayKey(),
    })
  } catch {
    // Usage tracking must not break the request path
  }
}
