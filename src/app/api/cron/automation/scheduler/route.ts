import { NextResponse } from 'next/server'
import { safeEqualString } from '@/lib/security/secrets'
import { runSchedulerTick } from '@/lib/automation/scheduler/tick'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function authorizeCron(req: Request): boolean {
  const secret = process.env.CHRONOS_CRON_SECRET || process.env.AUTOMATION_WORKER_SECRET
  if (!secret) return false
  const header = req.headers.get('authorization') || ''
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : ''
  const alt = req.headers.get('x-cron-secret') || ''
  return safeEqualString(bearer || alt, secret)
}

export async function POST(req: Request) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const result = await runSchedulerTick()
    return NextResponse.json({ ok: true, result })
  } catch {
    return NextResponse.json({ error: 'Scheduler tick failed' }, { status: 500 })
  }
}

export async function GET(req: Request) {
  return POST(req)
}
