# Phase 3 Security Audit

| Control | Status |
|---|---|
| Job tenant IDs immutable at enqueue from verified context | Yes |
| Client cannot set worker identity | Yes |
| Handler allowlist only | Yes |
| Workflow resume re-checks workspace active + execution scope | Yes |
| Job APIs workspace-scoped; unauthorized → 404 | Yes |
| Cron worker/scheduler require secret | Yes |
| Manual retry requires workspace admin | Yes |
| AI jobs use `assertAiBudget(initiatedBy)` | Yes |
| Payload secrets stripped from list responses | Partial (known keys) |
| Exactly-once email | **Not claimed** |
| Schedule tick not client-enqueueable | Yes |

## Residual risks

1. Email/AI provider duplicates on crash after side effect before checkpoint.
2. Sync execute path still available (`sync: true` or missing tenant IDs).
3. Phase 2.5 staging migration unfinished — new jobs require org/workspace IDs.
