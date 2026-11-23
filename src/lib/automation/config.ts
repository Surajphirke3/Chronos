function intEnv(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const n = parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

function boolEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name]
  if (raw === undefined || raw === '') return fallback
  return raw === 'true' || raw === '1'
}

export function getAutomationConfig() {
  return {
    workerEnabled: boolEnv('AUTOMATION_WORKER_ENABLED', false),
    concurrency: Math.min(intEnv('AUTOMATION_WORKER_CONCURRENCY', 2), 20),
    pollIntervalMs: intEnv('AUTOMATION_WORKER_POLL_INTERVAL_MS', 2000),
    leaseDurationMs: intEnv('AUTOMATION_LEASE_DURATION_MS', 5 * 60 * 1000),
    heartbeatIntervalMs: intEnv('AUTOMATION_HEARTBEAT_INTERVAL_MS', 30 * 1000),
    maxAttempts: intEnv('AUTOMATION_MAX_ATTEMPTS', 5),
    maxBackoffMs: intEnv('AUTOMATION_MAX_BACKOFF_MS', 15 * 60 * 1000),
    schedulerEnabled: boolEnv('AUTOMATION_SCHEDULER_ENABLED', false),
    asyncExecute: boolEnv('AUTOMATION_ASYNC_EXECUTE', true),
  }
}
