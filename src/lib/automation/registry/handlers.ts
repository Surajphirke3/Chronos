import type { JobExecutionContext, JobHandlerResult } from '@/lib/automation/types'
import { AutomationError } from '@/lib/automation/types'

export type JobHandler = (
  ctx: JobExecutionContext,
  payload: Record<string, unknown>
) => Promise<JobHandlerResult | void>

const registry = new Map<string, JobHandler>()

export function registerJobHandler(jobType: string, handler: JobHandler): void {
  if (registry.has(jobType)) {
    throw new Error(`Handler already registered for ${jobType}`)
  }
  registry.set(jobType, handler)
}

export function getJobHandler(jobType: string): JobHandler {
  const handler = registry.get(jobType)
  if (!handler) {
    throw new AutomationError(`No handler registered for job type: ${jobType}`, 'permanent')
  }
  return handler
}

export function listRegisteredJobTypes(): string[] {
  return [...registry.keys()].sort()
}

/** Test helper */
export function clearJobHandlersForTests(): void {
  registry.clear()
}
