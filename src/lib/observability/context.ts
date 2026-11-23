import { randomUUID } from 'crypto'

export type DiagnosticContext = {
  requestId: string
  correlationId?: string
  organizationId?: string | null
  workspaceId?: string | null
  userId?: string | null
  jobId?: string | null
}

/** Structured log helper — never pass secrets or document bodies. */
export function structuredLog(
  level: 'info' | 'warn' | 'error',
  message: string,
  ctx: Partial<DiagnosticContext> & Record<string, unknown> = {}
) {
  const safe = { ...ctx }
  for (const key of Object.keys(safe)) {
    if (/(secret|password|token|authorization|apiKey)/i.test(key)) {
      safe[key] = '[redacted]'
    }
  }
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    message,
    ...safe,
  })
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.info(line)
}

export function newRequestId(): string {
  return randomUUID()
}
