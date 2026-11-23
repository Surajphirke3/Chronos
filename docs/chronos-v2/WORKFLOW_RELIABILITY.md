# Workflow Reliability

## Problem

Delay/rate-limit nodes set `status: paused` + `nextExecutionAt`, but nothing resumed them.

## Foundation implemented

| Piece | Location |
|-------|----------|
| Lease fields | `WorkflowExecution.leaseOwner`, `leaseExpiresAt`, `retryCount` |
| Worker | `src/lib/engine/executionWorker.ts` |
| Cron route | `POST/GET /api/cron/workflows/resume` |
| Auth | `Authorization: Bearer $CHRONOS_CRON_SECRET` or `x-cron-secret` |

Guarantees:

- Atomic claim via `findOneAndUpdate`
- Bounded batch (default 10, max 25)
- Expired lease release
- Failure → re-pause with backoff `nextExecutionAt`
- Does not expose credentials in error messages

## Deployment requirement (manual)

Until an external scheduler calls the cron route with `CHRONOS_CRON_SECRET`, **background resume is not operational**.

Example (every minute):

```bash
curl -X POST "$NEXTAUTH_URL/api/cron/workflows/resume" \
  -H "Authorization: Bearer $CHRONOS_CRON_SECRET"
```

Vercel Cron / GitHub Actions / system cron are all valid. Configure in the host; do not commit secrets.

## Idempotency notes

- Claiming moves status to `running` under a lease; concurrent crons cannot claim the same doc.
- Email/AI steps inside `executeStep` are not yet fully idempotent at the provider level; retries after partial send remain a residual risk documented for a later phase.
