import { Types } from 'mongoose'
import { connectDB } from '@/lib/mongodb/client'
import { WorkflowExecution } from '@/lib/mongodb/models/WorkflowExecution'
import { executeStep } from '@/lib/engine/WorkflowEngine'
import { randomBytes } from 'crypto'

export type WorkerRunResult = {
  claimed: number
  processed: number
  succeeded: number
  failed: number
  releasedExpiredLeases: number
  errors: string[]
}

const DEFAULT_BATCH = 10
const DEFAULT_LEASE_MS = 5 * 60 * 1000
const MAX_BATCH = 25

function workerId(): string {
  return `worker_${randomBytes(6).toString('hex')}`
}

/** Release leases that expired while a worker crashed. */
export async function releaseExpiredLeases(now = new Date()): Promise<number> {
  await connectDB()
  const result = await WorkflowExecution.updateMany(
    {
      status: 'running',
      leaseExpiresAt: { $lte: now },
    },
    {
      $set: {
        status: 'paused',
        errorMessage: 'Execution lease expired; will retry',
        nextExecutionAt: now,
      },
      $unset: { leaseOwner: 1, leaseExpiresAt: 1 },
    }
  )
  return result.modifiedCount || 0
}

/**
 * Atomically claim due paused/pending executions for resume.
 * Idempotent across concurrent cron invocations via leaseOwner.
 */
export async function claimDueExecutions(params?: {
  batchSize?: number
  leaseMs?: number
  now?: Date
}): Promise<{ claims: { id: string }[]; worker: string }> {
  await connectDB()
  const batchSize = Math.min(Math.max(params?.batchSize || DEFAULT_BATCH, 1), MAX_BATCH)
  const leaseMs = params?.leaseMs || DEFAULT_LEASE_MS
  const now = params?.now || new Date()
  const worker = workerId()
  const claims: { id: string }[] = []

  for (let i = 0; i < batchSize; i++) {
    const doc = await WorkflowExecution.findOneAndUpdate(
      {
        status: { $in: ['paused', 'pending'] },
        nextExecutionAt: { $lte: now },
        $or: [
          { leaseExpiresAt: { $exists: false } },
          { leaseExpiresAt: null },
          { leaseExpiresAt: { $lte: now } },
        ],
      },
      {
        $set: {
          status: 'running',
          leaseOwner: worker,
          leaseExpiresAt: new Date(now.getTime() + leaseMs),
          errorMessage: '',
        },
      },
      { new: true, sort: { nextExecutionAt: 1 } }
    )

    if (!doc) break
    claims.push({ id: doc._id.toString() })
  }

  return { claims, worker }
}

export async function processClaimedExecution(executionId: string, worker: string): Promise<'success' | 'failed'> {
  await connectDB()
  if (!Types.ObjectId.isValid(executionId)) return 'failed'

  const owned = await WorkflowExecution.findOne({
    _id: executionId,
    leaseOwner: worker,
    status: 'running',
  })
  if (!owned) {
    return 'failed'
  }

  try {
    await executeStep(executionId)
    await WorkflowExecution.updateOne(
      { _id: executionId, leaseOwner: worker },
      { $unset: { leaseOwner: 1, leaseExpiresAt: 1 } }
    )
    return 'success'
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Worker execution failed'
    // Avoid logging secrets; store short failure reason only
    await WorkflowExecution.updateOne(
      { _id: executionId, leaseOwner: worker },
      {
        $set: {
          status: 'paused',
          errorMessage: message.slice(0, 300),
          nextExecutionAt: new Date(Date.now() + 5 * 60 * 1000),
          retryCount: (owned.retryCount || 0) + 1,
        },
        $unset: { leaseOwner: 1, leaseExpiresAt: 1 },
      }
    )
    return 'failed'
  }
}

export async function runExecutionWorker(options?: {
  batchSize?: number
  leaseMs?: number
}): Promise<WorkerRunResult> {
  const releasedExpiredLeases = await releaseExpiredLeases()
  const { claims, worker } = await claimDueExecutions(options)

  const result: WorkerRunResult = {
    claimed: claims.length,
    processed: 0,
    succeeded: 0,
    failed: 0,
    releasedExpiredLeases,
    errors: [],
  }

  for (const claim of claims) {
    const outcome = await processClaimedExecution(claim.id, worker)
    result.processed += 1
    if (outcome === 'success') result.succeeded += 1
    else {
      result.failed += 1
      result.errors.push(claim.id)
    }
  }

  return result
}
