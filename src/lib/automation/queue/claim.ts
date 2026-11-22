import { connectDB } from '@/lib/mongodb/client'
import { Job } from '@/lib/mongodb/models/Job'
import { getAutomationConfig } from '@/lib/automation/config'
import { newWorkerId, bumpCounter, automationLog } from '@/lib/automation/observability'
import { assertTransition } from '@/lib/automation/stateMachine'

/**
 * Release expired processing leases back to retrying/queued.
 */
export async function releaseExpiredJobLeases(now = new Date()): Promise<number> {
  await connectDB()
  const result = await Job.updateMany(
    {
      status: 'processing',
      leaseExpiresAt: { $lte: now },
    },
    {
      $set: {
        status: 'retrying',
        lastError: 'Lease expired; job will be retried',
        availableAt: now,
      },
      $unset: { lockedBy: 1, lockedAt: 1, leaseExpiresAt: 1, heartbeatAt: 1 },
    }
  )
  const n = result.modifiedCount || 0
  if (n > 0) bumpCounter('leasesExpired', n)
  return n
}

/**
 * Atomically claim due jobs. Never uses read-then-update.
 */
export async function claimJobs(params?: {
  batchSize?: number
  leaseMs?: number
  workerId?: string
  now?: Date
}): Promise<{ jobs: Array<{ id: string; jobType: string }>; workerId: string }> {
  await connectDB()
  const config = getAutomationConfig()
  const batchSize = Math.min(Math.max(params?.batchSize || config.concurrency, 1), 25)
  const leaseMs = params?.leaseMs || config.leaseDurationMs
  const now = params?.now || new Date()
  const workerId = params?.workerId || newWorkerId()
  const claimed: Array<{ id: string; jobType: string }> = []

  for (let i = 0; i < batchSize; i++) {
    const doc = await Job.findOneAndUpdate(
      {
        status: { $in: ['queued', 'scheduled', 'retrying'] },
        availableAt: { $lte: now },
        $or: [
          { leaseExpiresAt: { $exists: false } },
          { leaseExpiresAt: null },
          { leaseExpiresAt: { $lte: now } },
        ],
      },
      {
        $set: {
          status: 'processing',
          lockedBy: workerId,
          lockedAt: now,
          heartbeatAt: now,
          leaseExpiresAt: new Date(now.getTime() + leaseMs),
          startedAt: now,
        },
        $inc: { attempts: 1 },
      },
      { new: true, sort: { priority: -1, availableAt: 1, createdAt: 1 } }
    )

    if (!doc) break
    claimed.push({ id: String(doc._id), jobType: doc.jobType })
  }

  if (claimed.length) {
    automationLog('info', 'jobs.claimed', { workerId, count: claimed.length })
  }

  return { jobs: claimed, workerId }
}

export async function heartbeatJob(jobId: string, workerId: string, leaseMs?: number): Promise<boolean> {
  await connectDB()
  const ms = leaseMs || getAutomationConfig().leaseDurationMs
  const now = new Date()
  const updated = await Job.findOneAndUpdate(
    { _id: jobId, lockedBy: workerId, status: 'processing' },
    {
      $set: {
        heartbeatAt: now,
        leaseExpiresAt: new Date(now.getTime() + ms),
      },
    },
    { new: true }
  )
  return Boolean(updated)
}

export async function completeJob(
  jobId: string,
  workerId: string,
  result?: Record<string, unknown>
): Promise<void> {
  await connectDB()
  const job = await Job.findOne({ _id: jobId, lockedBy: workerId, status: 'processing' })
  if (!job) return
  assertTransition('processing', 'completed')
  job.status = 'completed'
  job.completedAt = new Date()
  job.result = result || {}
  job.lockedBy = undefined
  job.leaseExpiresAt = undefined
  job.heartbeatAt = undefined
  await job.save()
  bumpCounter('jobsCompleted')
}

export async function failOrRetryJob(params: {
  jobId: string
  workerId: string
  errorMessage: string
  errorClass: 'transient' | 'permanent'
  backoffMs: number
}): Promise<'retrying' | 'failed' | 'dead_letter'> {
  await connectDB()
  const job = await Job.findOne({
    _id: params.jobId,
    lockedBy: params.workerId,
    status: 'processing',
  })
  if (!job) return 'failed'

  const message = params.errorMessage.slice(0, 500)
  job.lastError = message
  job.errorClass = params.errorClass

  const unsetLease = () => {
    job.lockedBy = undefined
    job.lockedAt = undefined
    job.leaseExpiresAt = undefined
    job.heartbeatAt = undefined
  }

  if (params.errorClass === 'permanent') {
    assertTransition('processing', 'failed')
    job.status = 'failed'
    job.failedAt = new Date()
    unsetLease()
    await job.save()
    bumpCounter('jobsFailed')
    return 'failed'
  }

  if (job.attempts >= job.maxAttempts) {
    assertTransition('processing', 'dead_letter')
    job.status = 'dead_letter'
    job.failedAt = new Date()
    unsetLease()
    await job.save()
    bumpCounter('deadLetters')
    return 'dead_letter'
  }

  assertTransition('processing', 'retrying')
  job.status = 'retrying'
  job.availableAt = new Date(Date.now() + params.backoffMs)
  unsetLease()
  await job.save()
  bumpCounter('jobsRetried')
  return 'retrying'
}

export async function cancelJob(jobId: string): Promise<boolean> {
  await connectDB()
  const job = await Job.findById(jobId)
  if (!job) return false
  if (['completed', 'cancelled'].includes(job.status)) return false
  if (!['queued', 'scheduled', 'retrying', 'processing', 'failed', 'dead_letter'].includes(job.status)) {
    return false
  }
  // processing cancel is cooperative — mark cancelled; worker should check
  job.status = 'cancelled'
  job.lockedBy = undefined
  job.leaseExpiresAt = undefined
  await job.save()
  bumpCounter('jobsCancelled')
  return true
}

export async function requeueForManualRetry(jobId: string): Promise<boolean> {
  await connectDB()
  const job = await Job.findById(jobId)
  if (!job) return false
  if (!['failed', 'dead_letter'].includes(job.status)) return false
  assertTransition(job.status, 'queued')
  job.status = 'queued'
  job.availableAt = new Date()
  job.attempts = 0
  job.lastError = ''
  job.failedAt = undefined
  await job.save()
  return true
}
