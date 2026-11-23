# Phase 3 Worker Operations

## Modes

1. **HTTP cron tick** (serverless-friendly): `/api/cron/automation/worker`
2. **Process loop**: `AUTOMATION_WORKER_ENABLED=true npm run automation:worker`
3. **Scheduler tick**: `/api/cron/automation/scheduler`

## Recovery

- Expired `processing` leases → `retrying` with `availableAt=now`
- WorkflowExecution leases still cleaned via existing `releaseExpiredLeases`
- Dead-letter after `maxAttempts`; admin retry via API

## Staging checklist

1. Set `CHRONOS_CRON_SECRET`
2. Cron worker every minute
3. Cron scheduler every minute (if schedules used)
4. Execute workflow → expect 202 + jobs in `/automation`
5. Kill worker mid-run → lease expiry recovers job
6. Do **not** enable production workers until staging pass
