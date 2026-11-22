import { connectDB } from '@/lib/mongodb/client'
import { Job } from '@/lib/mongodb/models/Job'
import { getAutomationConfig } from '@/lib/automation/config'
import { newCorrelationId, newTraceId, bumpCounter, automationLog } from '@/lib/automation/observability'
import { AppError } from '@/lib/api/errors'
import { JOB_TYPES } from '@/lib/automation/types'

export type EnqueueJobInput = {
  organizationId: string
  workspaceId: string
  initiatedBy: string
  jobType: string
  payload?: Record<string, unknown>
  payloadVersion?: number
  priority?: number
  idempotencyKey?: string
  correlationId?: string
  traceId?: string
  availableAt?: Date
  maxAttempts?: number
}

const ALLOWED = new Set<string>(JOB_TYPES)

export function assertAllowedJobType(jobType: string): void {
  if (!ALLOWED.has(jobType) && !jobType.startsWith('workflow.') && !jobType.startsWith('ai.')) {
    // Allow registered prefixes; strict check happens at handler lookup time too
  }
  if (!jobType || jobType.length > 120) {
    throw new AppError('Invalid jobType', 400)
  }
}

export async function enqueueJob(input: EnqueueJobInput): Promise<{
  job: Record<string, unknown>
  created: boolean
}> {
  assertAllowedJobType(input.jobType)
  if (!input.organizationId || !input.workspaceId || !input.initiatedBy) {
    throw new AppError('Tenant context is required to enqueue a job', 400)
  }

  await connectDB()
  const config = getAutomationConfig()
  const availableAt = input.availableAt || new Date()
  const status = availableAt.getTime() > Date.now() + 500 ? 'scheduled' : 'queued'
  const correlationId = input.correlationId || newCorrelationId()
  const traceId = input.traceId || newTraceId()

  if (input.idempotencyKey) {
    const existing = await Job.findOne({
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      jobType: input.jobType,
      idempotencyKey: input.idempotencyKey,
    }).lean()
    if (existing) {
      return { job: existing as Record<string, unknown>, created: false }
    }
  }

  try {
    const job = await Job.create({
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      initiatedBy: input.initiatedBy,
      jobType: input.jobType,
      payload: input.payload || {},
      payloadVersion: input.payloadVersion || 1,
      status,
      priority: input.priority || 0,
      idempotencyKey: input.idempotencyKey || undefined,
      correlationId,
      traceId,
      attempts: 0,
      maxAttempts: input.maxAttempts || config.maxAttempts,
      availableAt,
    })
    bumpCounter('jobsCreated')
    automationLog('info', 'job.enqueued', {
      jobId: String(job._id),
      jobType: input.jobType,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      correlationId,
      status,
    })
    return { job: job.toObject(), created: true }
  } catch (error: unknown) {
    // Unique idempotency race
    if (
      input.idempotencyKey &&
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: number }).code === 11000
    ) {
      const existing = await Job.findOne({
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
        jobType: input.jobType,
        idempotencyKey: input.idempotencyKey,
      }).lean()
      if (existing) return { job: existing as Record<string, unknown>, created: false }
    }
    throw error
  }
}
