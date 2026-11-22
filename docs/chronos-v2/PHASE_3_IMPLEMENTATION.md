# Phase 3 Implementation Notes

## Delivered

| Area | Location |
|---|---|
| Job model + indexes | `src/lib/mongodb/models/Job.ts` |
| Enqueue + idempotency | `src/lib/automation/queue/enqueue.ts` |
| Atomic claim / lease / heartbeat / DLQ | `src/lib/automation/queue/claim.ts` |
| State machine | `src/lib/automation/stateMachine.ts` |
| Retry + classification | `src/lib/automation/retry.ts` |
| Handler registry | `src/lib/automation/registry/*` |
| Worker tick | `src/lib/automation/workers/*` |
| Cron worker | `POST /api/cron/automation/worker` |
| Process worker | `npm run automation:worker` |
| Workflow async execute | `/api/workflows/[id]/execute` → 202 + jobs |
| Definition snapshot | `Workflow.version`, `WorkflowExecution.definitionSnapshot` |
| Schedules | `AutomationSchedule` + `/api/automation/schedules` + scheduler cron |
| Job APIs | `/api/jobs`, cancel, retry |
| UI | `/automation`, `/automation/jobs/[jobId]` |

## Delivery guarantee

**At-least-once** job execution. Side effects (email/AI) are not exactly-once at the provider; step history + idempotency keys reduce duplicates.

## How to run locally

```bash
# Terminal A — app
npm run dev

# Terminal B — worker (optional; or hit cron)
AUTOMATION_WORKER_ENABLED=true npm run automation:worker

# Or cron-style:
curl -X POST "$NEXTAUTH_URL/api/cron/automation/worker" \
  -H "Authorization: Bearer $CHRONOS_CRON_SECRET"
curl -X POST "$NEXTAUTH_URL/api/cron/automation/scheduler" \
  -H "Authorization: Bearer $CHRONOS_CRON_SECRET"
```

## Flags

See `PHASE_3_ARCHITECTURE.md` §13. Defaults keep process worker and scheduler **off**.
