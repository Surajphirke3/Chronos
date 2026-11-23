import type { ErrorClass } from '@/lib/automation/types'
import { AutomationError } from '@/lib/automation/types'
import { getAutomationConfig } from '@/lib/automation/config'

/** Classify unknown errors; AutomationError wins. */
export function classifyError(error: unknown): ErrorClass {
  if (error instanceof AutomationError) return error.classification
  const message = error instanceof Error ? error.message.toLowerCase() : ''
  if (
    message.includes('unauthorized') ||
    message.includes('forbidden') ||
    message.includes('not found') ||
    message.includes('invalid') ||
    message.includes('validation') ||
    message.includes('malformed')
  ) {
    return 'permanent'
  }
  if (
    message.includes('timeout') ||
    message.includes('econnreset') ||
    message.includes('429') ||
    message.includes('503') ||
    message.includes('temporar') ||
    message.includes('rate limit')
  ) {
    return 'transient'
  }
  return 'transient'
}

/** Exponential backoff with full jitter, capped. */
export function computeBackoffMs(attempt: number): number {
  const { maxBackoffMs } = getAutomationConfig()
  const base = Math.min(maxBackoffMs, 1000 * Math.pow(2, Math.max(0, attempt - 1)))
  return Math.floor(Math.random() * (base + 1))
}
