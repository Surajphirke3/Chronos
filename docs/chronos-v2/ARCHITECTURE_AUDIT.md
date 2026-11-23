# Chronos V2 — Architecture Audit

**Phase:** 0  
**Date:** 2026-11-22

---

## 1. Separation of concerns

| Layer | Location | Assessment |
|-------|----------|------------|
| UI pages | `src/app/(workspace)/**` | Heavy client components; business rules often inline with fetch calls |
| API | `src/app/api/**` | Thin handlers; auth + DB inline; limited shared services |
| Domain logic | Partial in `src/lib/engine`, `src/lib/ai` | Outreach engine is the strongest service layer |
| Models | `src/lib/mongodb/models` | Schemas only; no repository pattern |
| Auth helpers | `src/lib/auth/*` | Expanded in Phase 0 (`access.ts`, `verifyFirebaseToken.ts`) |

**Finding:** No consistent service/repository layer for projects/tasks/docs. Duplicate populate/auth patterns across routes.

---

## 2. Frontend / backend boundaries

- Mutations go through `fetch` → Route Handlers (not Server Actions).
- Session available client-side via `SessionProvider` and server-side via `getServerSession`.
- Some secrets previously flowed to the client (settings GET) — mitigated Phase 0.
- AI provider keys also live in `localStorage` via Zustand — residual risk.

---

## 3. Server-side data access

- Every sensitive route uses `getServerSession` (verified).
- Middleware JWT gate is defense-in-depth (expanded Phase 0).
- Pre–Phase 0: projects/tasks/docs/activity used unbounded queries (`find()`).
- Phase 0: membership / author scoping via `projectVisibilityFilter` / `canAccessProject`.

---

## 4. Business logic organization

| Domain | Organization | Coupling |
|--------|--------------|----------|
| Outreach | `lib/engine/*` | Medium — AI + SMTP + orchestration in one module |
| AI chat providers | `lib/ai/providers.ts` | Low–medium |
| Workspace CRUD | Inside route handlers | High duplication |
| Workflow builder UI | Single large page | High |

---

## 5. Database access patterns

- Connection singleton with HMR cache — appropriate for serverless.
- Frequent `.populate()` on list endpoints.
- Chat list N+1: one query per chat for last message (`api/chats/route.ts`).
- No transactions for multi-document operations (project delete + tasks is sequential).

---

## 6. Reusable service layers

**Existing:** WorkflowEngine, SafetyGuards, RateLimiter, DelayScheduler, AI providers, Phase 0 access helpers.

**Missing:** ProjectService, TaskService, DocService, unified Authz middleware wrapper, shared Zod schemas, structured logger.

---

## 7. Error handling

- API: try/catch → `console.error` + generic 500 JSON.
- No `error.tsx` App Router boundaries.
- Inconsistent error shapes (`{ error }` vs `{ message }` vs `{ success }`).

---

## 8. Validation

- Zod in dependencies; routes use ad-hoc checks.
- Phase 0 added field whitelists for PATCH bodies (`pickAllowedFields`).
- Full Zod request schemas deferred to Phase 1.

---

## 9. Logging

- Ad-hoc `console.*` only.
- No correlation IDs, log levels, or PII scrubbing policy beyond avoiding password values in register logs (Phase 0 removed field logging).

---

## 10. Caching

- Client SWR with polling.
- No server HTTP cache headers or `unstable_cache`.
- In-memory rate limit maps (process-local).

---

## 11. Dependency management

- Lockfile present (`package-lock.json`).
- Several large UI libraries for a mid-size app (acceptable).
- `shadcn` CLI dependency without generated UI kit.

---

## 12. API consistency

| Pattern | Status |
|---------|--------|
| Auth 401 | Mostly consistent |
| JSON error key | Usually `error` |
| List response | Raw array vs `{ workflow }` wrapper — **inconsistent** |
| Pagination | Largely absent |
| Ownership | Outreach good; workspace fixed Phase 0 |

---

## Identified issues (architecture)

| Issue | Severity | Phase 0 action |
|-------|----------|----------------|
| Missing ownership on workspace APIs | P0 | **Fixed** |
| Mass assignment on PATCH | P0/P1 | **Fixed** (allowlists) |
| Sync workflow execution in HTTP | P1 | Documented |
| N+1 chats | P2 | Documented |
| No service layer | P2 | Documented |
| Inconsistent response envelopes | P3 | Documented |
| Circular dependencies | — | None verified |

---

## Foundation fixes applied (code)

See `PHASE_0_CHANGELOG.md`. Architecture was **not** rewritten; only high-impact access-control and auth foundations were strengthened.
