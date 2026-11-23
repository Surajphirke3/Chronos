# Chronos V2 — Phase 3 Architecture: Durable Async Automation

**Branch:** `feat/chronos-v2-phase-3`  
**Date:** 2026-11-23  
**Status:** Design approved for incremental implementation  
**Prerequisite:** Phase 2.5 staging migration still operational (not a code blocker for dual-read development)

---

## 1. Current architecture (discovered)

### Outreach workflow stack (exists)

| Component | Location | Role |
|---|---|---|
| Workflow definition | `Workflow` model | Graph of nodes/edges; status draft/active/paused/archived; optional `workspaceId` |
| Per-lead execution | `WorkflowExecution` model | `status`, `currentNodeId`, `stepHistory`, `nextExecutionAt`, lease fields |
| Step runner | `WorkflowEngine.executeStep` | Sync step: AI message, SMTP email, delay→pause, condition, tag |
| Delay helpers | `DelayScheduler` | Gaussian delay + business-hours adjust (UTC-biased) |
| Safety | `SafetyGuards` | Opt-out / bounce / email format |
| In-process rate limit | `engine/RateLimiter` | Per-owner memory limiter (not durable) |
| Lease worker | `executionWorker.ts` | Atomic claim of paused/pending executions; lease expiry release |
| Cron entry | `/api/cron/workflows/resume` | Bearer `CHRONOS_CRON_SECRET`; calls `runExecutionWorker` |
| Sync execute API | `/api/workflows/[id]/execute` | Creates executions and runs steps **inside the HTTP request** with inter-lead sleeps |

### What works today

- Atomic `findOneAndUpdate` claim with `leaseOwner` / `leaseExpiresAt`.
- Expired lease → `paused` + `nextExecutionAt` for retry.
- Step history append for completed nodes.
- Delay nodes pause and rely on cron resume.
- Tenant fields exist on Workflow / WorkflowExecution (optional until enforce).

### What does not exist / is incomplete

| Gap | Impact |
|---|---|
| No general-purpose Job collection | Cannot queue AI summarize, reports, arbitrary background work |
| Sync execute blocks HTTP | Timeouts; not durable for multi-lead runs |
| No heartbeat / lease renewal mid-step | Long AI/SMTP steps can exceed lease without renewal |
| Retries are ad-hoc | Fixed 5m pause; no exponential backoff, DLQ, error classification |
| No idempotency keys | Email/AI steps can duplicate on retry |
| No workflow version snapshot | Editing a live Workflow mutates in-flight executions |
| No recurring scheduler model | Only delay-based `nextExecutionAt` on executions |
| No automation dashboard for generic jobs | Monitor page is outreach-execution oriented |
| No correlation IDs / structured job metrics | Limited ops visibility |
| Worker only via cron HTTP | No dedicated long-running worker process loop |
| Engine RateLimiter is in-memory | Multi-instance incorrect |

---

## 2. Reusable components

**Reuse as-is or with thin adapters:**

1. `executionWorker.claimDueExecutions` pattern → generalize into Job claimer.
2. `WorkflowEngine.executeStep` → register as handler `workflow.execution.resume` (do not rewrite node semantics in Phase 3).
3. `DelayScheduler` / `SafetyGuards` → keep for outreach steps.
4. Tenancy: `getActiveTenantContext`, `workspaceScopedFilter`, `requireWorkspaceAccess`.
5. Secrets decryption, AI budget (`assertAiBudget`), durable app rate limits.
6. Cron secret auth pattern for worker/scheduler HTTP triggers.
7. Existing outreach monitor UI patterns for the new automation dashboard.

**Do not duplicate:** a second outreach step interpreter. Upgrade around WorkflowExecution.

---

## 3. Missing capabilities (Phase 3 scope)

1. Durable **Job** queue (Mongo-backed).
2. Handler registry (allowlisted job types only).
3. Worker loop with concurrency, heartbeat, graceful shutdown.
4. Centralized retry + dead-letter.
5. Workflow **definition version** snapshot on execute.
6. Step-level idempotency checkpoints (extend stepHistory).
7. **AutomationSchedule** for delayed/recurring job/workflow dispatch.
8. Bridge: sync execute → enqueue jobs (backward compatible response).
9. Tenant-aware AI background job types that map to existing AI capabilities.
10. APIs + automation dashboard + observability counters.

**Out of scope / deferred:** Redis/Kafka, webhooks hub, custom code nodes, exactly-once email provider guarantees, production worker enablement.

---

## 4. Proposed architecture

```
┌─────────────────────────────────────────────────────────────┐
│  API / UI  (session + tenant context)                       │
│  enqueue Job | manage schedules | view executions           │
└───────────────────────────┬─────────────────────────────────┘
                            │ persist Job (queued/scheduled)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  MongoDB                                                    │
│  Job | AutomationSchedule | Workflow (+version)             │
│  WorkflowExecution (existing, extended)                     │
└───────────────────────────┬─────────────────────────────────┘
                            │ atomic claim
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Automation Worker (cron HTTP and/or process loop)          │
│  claim → heartbeat → handler registry → complete/retry/DLQ  │
└───────────────────────────┬─────────────────────────────────┘
                            │
          ┌─────────────────┼─────────────────┐
          ▼                 ▼                 ▼
   workflow.resume    ai.*.jobs         schedule.tick
   (executeStep)      (existing AI)     (enqueue due jobs)
```

### Design decisions

| Decision | Choice | Rationale |
|---|---|---|
| Queue backend | MongoDB Job collection | Matches stack; no new infra |
| Claim | `findOneAndUpdate` with lease | Proven pattern from Phase 1 worker |
| Outreach engine | Keep `executeStep`; invoke via job | Avoid competing engines |
| Workflow versioning | Snapshot `definitionSnapshot` + `workflowVersion` on execution create | Immutability without rewriting builder |
| Sync execute API | Enqueue per-lead jobs (or one batch job) + return immediately | Removes HTTP timeout risk; monitor via job/execution IDs |
| Worker deploy | Same cron secret route + optional `scripts/automation-worker.ts` loop | Works on serverless hosts and dedicated processes |
| Exactly-once | **Not claimed** | At-least-once with idempotency keys for side effects |

---

## 5. Job lifecycle

```
                    ┌──────────────┐
         create ──► │ queued       │
                    │ scheduled    │◄── availableAt > now
                    └──────┬───────┘
                           │ claim (atomic)
                           ▼
                    ┌──────────────┐
                    │ processing   │── heartbeat / lease renew
                    └──────┬───────┘
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
     completed         retrying        cancelled
                           │
                           ▼ (attempts >= max)
                      dead_letter / failed
```

Valid transitions enforced in code (reject illegal jumps).

---

## 6. Workflow lifecycle (upgrade path)

1. User builds Workflow (mutable draft/active definition).
2. Execute → create `WorkflowExecution` with **frozen** `definitionSnapshot` + incrementing `workflowVersion` integer copied from Workflow.
3. Enqueue Job `workflow.execution.resume` with executionId + tenant context.
4. Worker claims job → renews lease → calls `executeStep` (or multi-step until pause/complete within deadline).
5. Delay node → execution paused + job completes successfully (resume job scheduled via `availableAt` or schedule tick).
6. Crash mid-step → lease expires → job recoverable; step idempotency key prevents duplicate email if checkpoint recorded.

---

## 7. Worker lifecycle

1. Start with `workerId` (hostname + random).
2. Optionally run `releaseExpiredLeases` for Jobs and WorkflowExecutions.
3. Claim up to `AUTOMATION_WORKER_CONCURRENCY` jobs.
4. For each: set heartbeat interval; execute handler; complete or retry.
5. SIGTERM: stop claiming; wait in-flight with deadline; exit.
6. HTTP cron mode: single batch per request (serverless-friendly).

Workers **never** read NextAuth session. Context comes only from Job fields.

---

## 8. MongoDB schema design

### Job

```
organizationId, workspaceId, initiatedBy
jobType (enum/string allowlist)
payload (Mixed), payloadVersion
status: queued|scheduled|processing|retrying|completed|failed|cancelled|dead_letter
priority (number, higher first)
idempotencyKey (unique with organizationId+workspaceId+jobType)
correlationId, traceId
attempts, maxAttempts
availableAt, startedAt, completedAt, failedAt
lockedAt, lockedBy, leaseExpiresAt, heartbeatAt
lastError, result
createdAt, updatedAt
```

**Indexes:**

- `{ status: 1, availableAt: 1, priority: -1 }` (claim)
- `{ organizationId: 1, workspaceId: 1, createdAt: -1 }`
- `{ organizationId: 1, workspaceId: 1, jobType: 1, idempotencyKey: 1 }` unique sparse
- `{ leaseExpiresAt: 1, status: 1 }`
- `{ correlationId: 1 }`

### AutomationSchedule

```
organizationId, workspaceId, createdBy
name, enabled
scheduleType: once|interval|cron
timezone
runAt / intervalMs / cronExpr
jobType, jobPayloadTemplate
nextRunAt, lastRunAt, lastJobId
idempotencyScope
status: active|paused|archived
```

**Indexes:** `{ enabled: 1, nextRunAt: 1 }`, `{ workspaceId: 1, status: 1 }`

### Workflow / WorkflowExecution extensions

- `Workflow.version` (number, increment on publish/save when active)
- `WorkflowExecution.definitionSnapshot` (nodes/edges/config copy)
- `WorkflowExecution.workflowVersion`
- `WorkflowExecution.correlationId`
- `WorkflowExecution.organizationId` / `workspaceId` required on new writes
- Step history: add `idempotencyKey`, `attempt`

---

## 9. Failure recovery strategy

| Failure | Response |
|---|---|
| Worker crash | Lease expiry → status retrying/queued; re-claim |
| Transient AI/SMTP | Classify transient → exponential backoff + jitter |
| Permanent validation/authz | Fail immediately → `failed` (not DLQ spam) |
| Max attempts | `dead_letter`; manual retry API |
| Duplicate enqueue | Idempotency key returns existing job |
| Partial email send | Step checkpoint + idempotency key; document residual provider risk |

---

## 10. Tenant isolation strategy

- Job stores immutable `organizationId` / `workspaceId` / `initiatedBy` at creation from **verified** server context.
- Handlers re-validate workspace membership of `initiatedBy` OR workspace still active before side effects (configurable; default: workspace active + resource belongs to workspace).
- Payload IDs (leadId, docId, executionId) loaded with `workspaceId` match filter.
- APIs list/get jobs only via `workspaceScopedFilter`.
- Cross-tenant job ID → 404.
- Platform cron secret ≠ org admin.

---

## 11. API design (incremental)

Reuse `/api/workflows*` for definitions; add:

| Endpoint | Purpose |
|---|---|
| `POST/GET /api/jobs` | Enqueue / list (workspace-scoped) |
| `GET /api/jobs/[jobId]` | Detail |
| `POST /api/jobs/[jobId]/cancel` | Cancel |
| `POST /api/jobs/[jobId]/retry` | Manual retry from DLQ/failed |
| `GET/POST /api/automation/schedules` | Schedules |
| `PATCH/DELETE /api/automation/schedules/[id]` | Update/disable |
| `POST /api/cron/automation/worker` | Protected worker tick |
| `POST /api/cron/automation/scheduler` | Protected schedule tick |
| Keep `/api/cron/workflows/resume` | Bridge: also drains workflow jobs or delegates |

Execute route becomes: create executions + enqueue resume jobs (202) instead of long sync loop when `AUTOMATION_ASYNC_EXECUTE=true` (default true in new code path with sync fallback flag for compatibility).

---

## 12. Security considerations

- Allowlisted handlers only (no dynamic `eval` / user function names).
- Worker/scheduler routes: `CHRONOS_CRON_SECRET` (or dedicated `AUTOMATION_WORKER_SECRET`).
- Rate limit job creation per user/workspace.
- Redact payload secrets in API responses and logs.
- Audit privileged cancel/retry.
- Do not log raw email bodies / API keys.
- Stale membership: fail job permanently with clear error.

---

## 13. Operational requirements

| Variable | Default | Purpose |
|---|---|---|
| `AUTOMATION_WORKER_ENABLED` | `false` | Gate process worker |
| `AUTOMATION_WORKER_CONCURRENCY` | `2` | Parallel jobs per tick |
| `AUTOMATION_WORKER_POLL_INTERVAL_MS` | `2000` | Process loop sleep |
| `AUTOMATION_LEASE_DURATION_MS` | `300000` | Lease length |
| `AUTOMATION_HEARTBEAT_INTERVAL_MS` | `30000` | Renew cadence |
| `AUTOMATION_MAX_ATTEMPTS` | `5` | Retry cap |
| `AUTOMATION_MAX_BACKOFF_MS` | `900000` | Backoff ceiling |
| `AUTOMATION_SCHEDULER_ENABLED` | `false` | Schedule tick gate |
| `AUTOMATION_ASYNC_EXECUTE` | `true` | Workflow execute enqueues jobs |
| `CHRONOS_CRON_SECRET` | required for cron | Auth worker/scheduler HTTP |

Local: `npx tsx scripts/automation-worker.ts` with env enabled.  
Staging: cron every minute to worker + scheduler routes.  
Production: **do not enable** until staging failure-recovery verified.

---

## 14. Implementation sequence

1. **3.0** Architecture doc (this file) ✓  
2. **3.1** Job model + enqueue + state machine + indexes  
3. **3.2** Atomic claim + heartbeat + recovery + worker tick  
4. **3.3** Retry/backoff/DLQ + classification  
5. **3.4** Bridge WorkflowExecution → jobs; version snapshot; step idempotency fields  
6. **3.5** AutomationSchedule + scheduler tick  
7. **3.6** AI job handlers (summarize / generate-tasks style)  
8. **3.7** Management APIs  
9. **3.8** Automation dashboard UI  
10. **3.9** Metrics + docs + tests  

Review checkpoint after each major commit series.

---

## 15. Risks and trade-offs

| Risk | Mitigation |
|---|---|
| Mongo claim hot spot | Compound index; small batches; priority fairness later |
| Changing sync execute behavior | Feature flag `AUTOMATION_ASYNC_EXECUTE`; keep sync path until stable |
| Email duplicate on retry | Step idempotency keys; document provider at-least-once |
| Serverless maxDuration | Short lease ticks; one/few steps per job claim |
| Phase 2.5 migration unfinished | New writes always set tenant IDs; dual-read still applies |
| Scope creep vs n8n | Stay within existing node types; no new integration platform |

---

## 16. Conflicts with the Phase 3 brief

| Brief suggestion | Adaptation |
|---|---|
| Separate WorkflowDefinition model | Keep `Workflow` as definition; add `version` + execution snapshot |
| Separate WorkflowStepExecution collection | Extend `stepHistory` first; extract collection only if query needs demand it |
| Full cron parser mandatory | Support `once` + `interval` first; cron expression optional if `cron-parser` not already depended — prefer interval/once to avoid new deps unless needed |
| Dedicated microservices | Stay in Next.js + optional worker script |

---

## 17. Delivery guarantee statement

Chronos automation provides **at-least-once** job execution with **best-effort idempotent side effects** via idempotency keys and step checkpoints. It does **not** provide exactly-once delivery to external email/AI providers.
