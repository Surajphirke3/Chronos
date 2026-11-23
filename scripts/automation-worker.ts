/**
 * Long-running automation worker loop (optional).
 *
 *   AUTOMATION_WORKER_ENABLED=true npx tsx scripts/automation-worker.ts
 *
 * Prefer cron HTTP in serverless. Do not enable in production without staging verification.
 */

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env', override: false })

import { getAutomationConfig } from '../src/lib/automation/config'
import { runAutomationWorkerTick } from '../src/lib/automation/workers/tick'
import { automationLog } from '../src/lib/automation/observability'

async function main() {
  const config = getAutomationConfig()
  if (!config.workerEnabled) {
    console.error('Set AUTOMATION_WORKER_ENABLED=true to run the process worker')
    process.exit(1)
  }

  let stopping = false
  const stop = () => {
    stopping = true
    automationLog('info', 'worker.shutdown_requested', {})
  }
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)

  automationLog('info', 'worker.started', {
    concurrency: config.concurrency,
    pollIntervalMs: config.pollIntervalMs,
  })

  while (!stopping) {
    try {
      await runAutomationWorkerTick()
    } catch (error) {
      automationLog('error', 'worker.tick_error', {
        error: error instanceof Error ? error.message : 'unknown',
      })
    }
    await new Promise((r) => setTimeout(r, config.pollIntervalMs))
  }

  automationLog('info', 'worker.stopped', {})
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : 'worker failed')
  process.exit(1)
})
