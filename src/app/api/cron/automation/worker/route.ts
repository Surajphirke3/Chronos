import { NextResponse } from 'next/server'
import { safeEqualString } from '@/lib/security/secrets'
import { runAutomationWorkerTick } from '@/lib/automation/workers/tick'
import { getAutomationConfig } from '@/lib/automation/config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function authorizeCron(req: Request): boolean {
  const secret = process.env.CHRONOS_CRON_SECRET || process.env.AUTOMATION_WORKER_SECRET
  if (!secret) return false
  const header = req.headers.get('authorization') || ''
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : ''
  const alt = req.headers.get('x-cron-secret') || ''
  return safeEqualString(bearer || alt, secret)
}

/**
 * Protected automation worker tick.
 * Configure external cron; do not enable unauthenticated public access.
 */
export async function POST(req: Request) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const config = getAutomationConfig()
  // HTTP cron may run even when process-loop worker is disabled
  try {
    const result = await runAutomationWorkerTick({
      batchSize: config.concurrency,
      leaseMs: config.leaseDurationMs,
    })
    return NextResponse.json({ ok: true, result })
  } catch {
    return NextResponse.json({ error: 'Worker tick failed' }, { status: 500 })
  }
}

export async function GET(req: Request) {
  return POST(req)
}
