import { NextResponse } from 'next/server'
import { runExecutionWorker } from '@/lib/engine/executionWorker'
import { safeEqualString } from '@/lib/security/secrets'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function authorizeCron(req: Request): boolean {
  const secret = process.env.CHRONOS_CRON_SECRET
  if (!secret) return false
  const header = req.headers.get('authorization') || ''
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : ''
  const alt = req.headers.get('x-cron-secret') || ''
  return safeEqualString(bearer || alt, secret)
}

/**
 * Scheduled resume endpoint for paused/due workflow executions.
 * Protect with CHRONOS_CRON_SECRET. Configure an external cron (or Vercel Cron)
 * to POST/GET this route on an interval (e.g. every minute).
 *
 * Until cron is configured in the deployment platform, background resume is
 * not operational — only the application-side foundation exists.
 */
export async function POST(req: Request) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runExecutionWorker({ batchSize: 10 })
    return NextResponse.json({ ok: true, result })
  } catch {
    return NextResponse.json({ error: 'Worker failed' }, { status: 500 })
  }
}

export async function GET(req: Request) {
  return POST(req)
}
