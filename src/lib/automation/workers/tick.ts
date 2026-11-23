import { getAutomationConfig } from '@/lib/automation/config'
import { claimJobs, releaseExpiredJobLeases } from '@/lib/automation/queue/claim'
import { ensureAutomationHandlersRegistered } from '@/lib/automation/registry/bootstrap'
import { runClaimedJob } from '@/lib/automation/workers/runJob'
import { automationLog, getAutomationCounters } from '@/lib/automation/observability'
import { releaseExpiredLeases as releaseWorkflowLeases } from '@/lib/engine/executionWorker'

export type WorkerTickResult = {
  releasedJobLeases: number
  releasedWorkflowLeases: number
  claimed: number
  succeeded: number
  failed: number
  counters: ReturnType<typeof getAutomationCounters>
}

/**
 * Single worker tick — safe for serverless cron or process loop.
 */
export async function runAutomationWorkerTick(options?: {
  batchSize?: number
  leaseMs?: number
}): Promise<WorkerTickResult> {
  ensureAutomationHandlersRegistered()
  const config = getAutomationConfig()

  const releasedJobLeases = await releaseExpiredJobLeases()
  let releasedWorkflowLeases = 0
  try {
    releasedWorkflowLeases = await releaseWorkflowLeases()
  } catch {
    // Workflow lease cleanup is best-effort alongside the job worker
  }

  const { jobs, workerId } = await claimJobs({
    batchSize: options?.batchSize || config.concurrency,
    leaseMs: options?.leaseMs || config.leaseDurationMs,
  })

  let succeeded = 0
  let failed = 0

  // Bounded concurrency within the tick
  const concurrency = Math.min(config.concurrency, jobs.length || 1)
  const queue = [...jobs]
  const runners: Promise<void>[] = []

  async function consume() {
    while (queue.length) {
      const next = queue.shift()
      if (!next) break
      const outcome = await runClaimedJob(next.id, workerId)
      if (outcome === 'success') succeeded += 1
      else failed += 1
    }
  }

  for (let i = 0; i < concurrency; i++) {
    runners.push(consume())
  }
  await Promise.all(runners)

  const result: WorkerTickResult = {
    releasedJobLeases,
    releasedWorkflowLeases,
    claimed: jobs.length,
    succeeded,
    failed,
    counters: getAutomationCounters(),
  }

  automationLog('info', 'worker.tick', {
    workerId,
    ...result,
    counters: undefined,
  })

  return result
}
