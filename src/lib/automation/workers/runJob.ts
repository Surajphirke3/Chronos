import { connectDB } from '@/lib/mongodb/client'
import { Job } from '@/lib/mongodb/models/Job'
import { getJobHandler } from '@/lib/automation/registry/handlers'
import { heartbeatJob, completeJob, failOrRetryJob } from '@/lib/automation/queue/claim'
import { classifyError, computeBackoffMs } from '@/lib/automation/retry'
import { getAutomationConfig } from '@/lib/automation/config'
import { automationLog } from '@/lib/automation/observability'
import type { JobExecutionContext } from '@/lib/automation/types'

export async function runClaimedJob(jobId: string, workerId: string): Promise<'success' | 'failed'> {
  await connectDB()
  const config = getAutomationConfig()
  const job = await Job.findOne({ _id: jobId, lockedBy: workerId, status: 'processing' })
  if (!job) return 'failed'

  // Cooperative cancel
  if (job.status === 'cancelled') return 'failed'

  const deadline = new Date(Date.now() + config.leaseDurationMs)
  const ctx: JobExecutionContext = {
    organizationId: String(job.organizationId),
    workspaceId: String(job.workspaceId),
    initiatedBy: String(job.initiatedBy),
    jobId: String(job._id),
    correlationId: job.correlationId,
    idempotencyKey: job.idempotencyKey || String(job._id),
    payloadVersion: job.payloadVersion || 1,
    workerId,
    attempt: job.attempts,
    traceId: job.traceId,
    executionDeadline: deadline,
  }

  const heartbeatTimer = setInterval(() => {
    void heartbeatJob(jobId, workerId, config.leaseDurationMs)
  }, config.heartbeatIntervalMs)

  try {
    const handler = getJobHandler(job.jobType)
    const payload =
      job.payload && typeof job.payload === 'object' ? (job.payload as Record<string, unknown>) : {}
    const outcome = await handler(ctx, payload)
    const result =
      outcome && typeof outcome === 'object' && 'result' in outcome
        ? (outcome.result as Record<string, unknown> | undefined)
        : undefined
    await completeJob(jobId, workerId, result)
    automationLog('info', 'job.completed', {
      jobId,
      jobType: job.jobType,
      organizationId: ctx.organizationId,
      workspaceId: ctx.workspaceId,
      correlationId: ctx.correlationId,
      attempt: ctx.attempt,
    })
    return 'success'
  } catch (error) {
    const errorClass = classifyError(error)
    const message = error instanceof Error ? error.message : 'Job failed'
    const backoffMs = errorClass === 'transient' ? computeBackoffMs(job.attempts) : 0
    const next = await failOrRetryJob({
      jobId,
      workerId,
      errorMessage: message,
      errorClass,
      backoffMs,
    })
    automationLog('warn', 'job.failed', {
      jobId,
      jobType: job.jobType,
      organizationId: ctx.organizationId,
      workspaceId: ctx.workspaceId,
      correlationId: ctx.correlationId,
      errorClass,
      next,
      attempt: ctx.attempt,
    })
    return 'failed'
  } finally {
    clearInterval(heartbeatTimer)
  }
}
