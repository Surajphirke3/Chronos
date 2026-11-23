# Chronos V2 — Reliability & Performance Audit

**Phase:** 0  
**Date:** 2026-11-22

---

## Error boundaries

- No App Router `error.tsx` / `global-error.tsx` found
- API errors swallowed into generic 500 JSON
- Frontend relies on toasts / SWR error states

---

## Logging

- `console.error` / occasional `console.log`
- No structured logger, request IDs, or log shipping

---

## Database connections

- Mongoose singleton with `bufferCommands: false` — appropriate for serverless
- No explicit pool tuning documented

---

## Query efficiency

| Hotspot | Issue | Priority |
|---------|-------|----------|
| `GET /api/chats` | N+1 last-message queries | P2 |
| `GET /api/tasks` without projectId | Loads all accessible project IDs then tasks | Acceptable Phase 0; watch scale |
| Messages by chat | Unpaginated full history | P2 |
| Workflow execute | Sequential leads + recursive steps in one HTTP request | P1 |

---

## Caching

- SWR client polling (3–30s)
- No server cache layer

---

## Memory-intensive operations

- Lead import loads entire file into memory (capped 5MB Phase 0)
- Workflow graphs stored as large Mixed documents
- TipTap docs as Mixed in Mongo

---

## Timeouts

- AI providers helper: 30s
- WorkflowEngine.callAI: **30s added Phase 0**
- Bulk execute: no overall request deadline — Vercel/serverless timeout risk

---

## Background jobs & schedules

| Capability | Status |
|------------|--------|
| Queue (Bull/Inngest/etc.) | **Missing** |
| Cron / Vercel cron | **Missing** |
| Resume `paused` executions by `nextExecutionAt` | **Missing — critical functional gap** |
| In-memory RateLimiter | Resets on cold start; not multi-instance safe |

**Operations that should move to workers:**

1. Workflow step advancement after delays
2. Bulk lead outreach execution
3. Rate-limit deferred retries
4. Future email bounce/webhook processing

**Phase 0 decision:** Do **not** introduce a queue framework yet; document requirement for Phase 1.

---

## Retry mechanisms

- None for AI/SMTP beyond single attempt
- No idempotency keys on execute

---

## Health checks / startup

- No `/api/health`
- Startup = Next.js boot + lazy Mongo connect on first request
- Empty `next.config.ts`

---

## Phase 0 reliability fixes

- AI fetch timeout in WorkflowEngine
- Import size/row limits
- Indexes for future job polling (`status + nextExecutionAt`)

Paused workflow resume remains **documented, not implemented**.
