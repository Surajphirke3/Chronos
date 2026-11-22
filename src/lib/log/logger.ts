import { randomBytes } from 'crypto'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const SENSITIVE = /(password|secret|token|apikey|api_key|authorization|smtpPass|emailAppPassword)/i

function redact(value: unknown): unknown {
  if (typeof value === 'string') {
    if (value.startsWith('enc:v1:')) return '[encrypted]'
    if (value.length > 8 && SENSITIVE.test(value)) return '[redacted]'
    return value
  }
  if (Array.isArray(value)) return value.map(redact)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE.test(k) ? '[redacted]' : redact(v)
    }
    return out
  }
  return value
}

export function createRequestId(): string {
  return randomBytes(8).toString('hex')
}

export function log(level: LogLevel, message: string, fields?: Record<string, unknown>) {
  const entry = {
    level,
    message,
    time: new Date().toISOString(),
    ...(fields ? (redact(fields) as Record<string, unknown>) : {}),
  }
  const line = JSON.stringify(entry)
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}
