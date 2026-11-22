import { randomBytes } from 'crypto'

export function newCorrelationId(): string {
  return `corr_${randomBytes(12).toString('hex')}`
}

export function newTraceId(): string {
  return `trc_${randomBytes(12).toString('hex')}`
}

export function newWorkerId(): string {
  return `worker_${randomBytes(6).toString('hex')}`
}

type LogFields = Record<string, unknown>

/** Structured log without dumping sensitive payloads. */
export function automationLog(
  level: 'info' | 'warn' | 'error',
  message: string,
  fields: LogFields = {}
): void {
  const safe: LogFields = { ...fields }
  delete safe.payload
  delete safe.result
  delete safe.apiKey
  delete safe.smtpPass
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    scope: 'automation',
    level,
    message,
    ...safe,
  })
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}

export type AutomationCounters = {
  jobsCreated: number
  jobsCompleted: number
  jobsFailed: number
  jobsRetried: number
  jobsCancelled: number
  leasesExpired: number
  deadLetters: number
}

const counters: AutomationCounters = {
  jobsCreated: 0,
  jobsCompleted: 0,
  jobsFailed: 0,
  jobsRetried: 0,
  jobsCancelled: 0,
  leasesExpired: 0,
  deadLetters: 0,
}

export function bumpCounter(key: keyof AutomationCounters, n = 1): void {
  counters[key] += n
}

export function getAutomationCounters(): AutomationCounters {
  return { ...counters }
}
