# Chronos V2 — Master Plan

**Status snapshot:** See [`CURRENT_STATUS.md`](./CURRENT_STATUS.md) first.  
**Branch:** `feat/chronos-v2-phase-5` · **Date:** 2026-11-23  

**Summary:** Phases 0–3 code-complete with staging ops remaining · Phase 4 billing **models only** · Phases 5–8 **implemented with limitations** (flags off) · **NOT production ready**

---

## 1. Verified current capabilities

- Next.js 16 App Router monolith with MongoDB/Mongoose
- Credentials auth + native Google OAuth (NextAuth; Firebase removed in Phase 1)
- Organizations / workspaces / memberships / invitations (Phase 2)
- Projects, tasks (Kanban), docs (TipTap), messaging (polling), team directory
- User settings for Gmail SMTP + AI keys (encrypted at rest; redacted on read)
- Outreach workflows with async execute + durable job resume (Phase 3)
- Automation dashboard, schedules (once/interval), AI background job types
- Governance: permission catalog, custom roles, audit, API keys, security policies, exports, platform admin (Phase 5; **flags off**)
- Integration provider catalog + webhook signing foundations (Phase 6; **flags off**)
- Knowledge bases + lexical RAG foundations (Phase 7; **flags off**)
- AI tools: summarize, PRD writer (stream), generate-tasks (env Groq)
- i18n + theme

---

## 2. Current gaps (remaining)

| Gap | Impact |
|-----|--------|
| Phase 4 billing runtime (APIs/UI/mock gateway) missing | Cannot sell or meter commercially |
| `MULTI_TENANT_ENFORCE` not staging-approved | Dual-read still active |
| Production workers / cron not verified | Automation reliability unknown in ops |
| Live OAuth integrations not connected | Catalog only |
| Agent runtime / embeddings deferred | AI platform incomplete |
| No password reset / email verify (credentials) | Auth polish |
| Announcements / notifications stubs | Product polish |
| README may still overclaim some features | Trust / onboarding |

---

## 3. Architectural decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Stack | Keep Next.js + Mongoose + NextAuth | Non-negotiable Phase 0 rule |
| Tenancy | Organization + Workspace + Memberships | Implemented Phase 2; dual-read until enforce |
| ACL precursor | Project owner/member/admin | Matches existing schema |
| Google auth | Native Google OAuth via NextAuth | Firebase removed |
| Queues | Mongo durable jobs (Phase 3) | No Redis/Kafka required |
| API style | Continue Route Handlers | No parallel Server Actions rewrite |
| Secrets | Encrypted at rest (Phase 1) | AES-GCM |

**Billing unit:** Organization (locked; Phase 4 runtime still incomplete).  
**Governance:** Implemented on this branch behind flags — see `CURRENT_STATUS.md` and `PHASE_5_*.md`.

---

## 4. Phase dependencies

```
Phase 0 ──► Phase 1 ──► Phase 2 / 2.5 ──► Phase 3
                                    ├─► Phase 4 (billing runtime — incomplete)
                                    ├─► Phase 5 (governance — done w/ limitations)
                                    ├─► Phase 6 (integrations foundation)
                                    ├─► Phase 7 (AI platform foundation)
                                    ├─► Phase 8 (ops docs / helpers)
                                    └─► Later product expansion
```

---

## 5. Migration risks

| Risk | Mitigation |
|------|------------|
| Membership filter hides legacy projects | Audit `members[]`; backfill owners into members |
| Google login requires idToken | Updated login UI; old clients break intentionally |
| Password min length 8 | Existing short passwords still login; new regs need 8 |
| Settings no longer return secrets | UI updated to use `*Set` flags |
| Multi-tenant backfill | Dual-read flag; default workspace |

---

## 6. Implementation order (recommended)

### Phase 1 — Security & reliability

**Status: implemented on `feat/chronos-v2-phase-1` (requires staging verification).**

1. [x] Native Google OAuth (Firebase Auth removed)  
2. [x] Encrypt UserSettings / workflow secrets at rest (+ migrator)  
3. [x] Durable MongoDB rate limits; login throttling  
4. [x] AI usage quotas + tracking  
5. [x] Workflow resume worker foundation + cron route (host cron still required)  
6. [x] Zod helpers + pagination standards (partial route coverage)  
7. [x] CI workflow + expanded unit tests  
8. [x] Chat N+1 fix; message/leads pagination; health + error boundary  
9. [ ] Deep integration/IDOR API tests against live Mongo (manual/staging)  
10. [ ] Production `ALLOW_PUBLIC_REGISTRATION=false` + cron wiring (ops)  

### Phase 2 — Multi-tenancy

**Status: implemented on `feat/chronos-v2-phase-2` (requires staging migration + isolation verification).**

1. [x] Organization / Workspace / Membership / Invitation models  
2. [x] Idempotent default tenant migration (`migrate:tenancy`)  
3. [x] Session active org/workspace + switch API  
4. [x] Workspace isolation on core resource APIs (dual-read via `MULTI_TENANT_ENFORCE`)  
5. [x] Invitations (hash-only tokens, SMTP send, accept/revoke)  
6. [x] Switcher / onboarding / org+workspace settings UI  
7. [ ] Operator `--apply` migration on staging DB clone  
8. [ ] Set `MULTI_TENANT_ENFORCE=true` after backfill verification  

### Phase 2.5 — Staging verification & cutover readiness

**Status: code verification complete; decision B (fixes applied). Staging DB apply still required.**

1. [x] Route-by-route tenant API audit matrix  
2. [x] AI tenant isolation audit  
3. [x] Dual-read cross-tenant leak fixed (`allowsLegacyUnscopedRead`)  
4. [x] Invitation accept email atomic claim + preview rate limit  
5. [x] AI routes require tenant context under enforce  
6. [x] Unit/typecheck/lint/build green after fixes  
7. [ ] Staging clone migration dry-run + apply with recorded counts  
8. [ ] Staging cross-org IDOR + SMTP invite E2E  
9. [ ] Explicit approval for staging `MULTI_TENANT_ENFORCE=true` (not production)  

### Phase 3 — Async automation

**Status: implemented on `feat/chronos-v2-phase-3` with documented limitations (decision B).**

1. [x] Durable Job queue (Mongo) + atomic claim/lease/heartbeat  
2. [x] Retry / dead-letter + handler registry  
3. [x] Workflow execute → async jobs + definition snapshot  
4. [x] Scheduler (once/interval) + cron ticks  
5. [x] Tenant-aware AI background job types  
6. [x] Job APIs + automation dashboard  
7. [ ] Staging cron failure-recovery drill  
8. [ ] Webhooks (deferred)  

### Phase 4 — Billing, subscriptions & usage metering

**Status: in progress on `feat/chronos-v2-phase-4` (Checkpoint 1 models committed; runtime/API/UI incomplete).**

1. [x] Architecture + approved MockRazorpay-first decisions  
2. [x] Plan / Subscription / Payment / Invoice / event models + state machine + seeds  
3. [ ] Free-plan bootstrap + lifecycle service  
4. [ ] MockRazorpay provider + simulated checkout  
5. [ ] Idempotent payment event processing  
6. [ ] UsageEvent / UsageAggregate + entitlement helpers (flag off)  
7. [ ] Billing APIs + `/settings/billing` + platform admin  
8. [ ] Staging mock payment drill — production billing remains disabled  

### Phase 5 — Enterprise governance & security

**Status: implemented with limitations on `feat/chronos-v2-phase-5` (feature flags default off; staging verification required).**

1. [x] Permission catalog + evaluation — `PHASE_5_RBAC.md`  
2. [x] Organization custom roles  
3. [x] Immutable `AuditEvent` + dashboard  
4. [x] Organization API keys (hashed secrets, scopes)  
5. [x] Organization security policies (no fake MFA)  
6. [x] Data export via Phase 3 jobs (retention apply deferred)  
7. [x] Platform governance console (`platformRole` only)  
8. [x] Docs + flags-off rollout plan  

See `docs/chronos-v2/PHASE_5_ARCHITECTURE.md`.

### Phase 6 — Integrations & ecosystem

**Status: foundation implemented with limitations (catalog + webhook crypto; live OAuth deferred).**

1. [x] Provider registry + connection model  
2. [x] Webhook endpoint/delivery models + HMAC signing  
3. [x] Public API probe `/api/v1/me`  
4. [ ] Live Slack/GitHub/Google OAuth (blocked on credentials)  
5. [ ] Outbound webhook delivery worker  

### Phase 7 — AI intelligence platform

**Status: foundation implemented with limitations (KB + lexical RAG; agent runtime deferred).**

1. [x] Knowledge bases + document ingest/chunking  
2. [x] Tenant-scoped retrieval  
3. [x] Agent + human approval models  
4. [ ] Full agent tool runtime  
5. [ ] Embedding/vector ranking  

### Phase 8 — Production scale & reliability

**Status: observability helpers + runbooks; NOT production ready.**

1. [x] Structured logging helper  
2. [x] DR / deployment / security audit docs  
3. [ ] Staging load + backup verification (ops)  

### Later — Product expansion (deferred)

1. Attachments with ACL  
2. Password reset / email verification  
3. Announcements + real notifications  
4. Team subgroup UX (model exists; unused)  

---

## 7. Acceptance criteria (Phase 0)

- [x] Repository audited from source  
- [x] Docs set under `docs/chronos-v2/`  
- [x] P0 auth bypass fixed in code  
- [x] P0 IDOR fixed for projects/tasks/docs/activity  
- [x] No stack replacement / no multi-tenancy implementation  
- [x] Baseline unit tests for ACL helpers  
- [ ] Full `test` / `typecheck` / `lint` / `build` green in CI environment (run locally; record results)

---

## 8. Testing requirements going forward

Every subsequent phase must:

1. Add/extend tests for authz on touched resources  
2. Run `typecheck`, `test`, `lint`, `build`  
3. Document manual checks for Google OAuth / SMTP / cron when env-dependent  

---

## 9. Phase 1 → Phase 2 gate

**Classification: Requires staging verification (not a code blocker for dual-read Phase 2).**

Outstanding Phase 1 manual checks (still open):

1. Verify Google Cloud OAuth against real credentials.  
2. Run secrets migration dry-run/`--apply` on a backed-up database.  
3. Configure `/api/cron/workflows/resume` with `CHRONOS_CRON_SECRET`.  
4. Set `ALLOW_PUBLIC_REGISTRATION=false` in staging/production.  
5. Confirm CI green on the feature branch.

## 10. Phase 2 → Phase 3 gate

**Classification: Requires staging verification.**  
**Phase 2.5 decision: B — READY AFTER LISTED FIXES (fixes committed; staging ops remaining).**

1. Run `migrate:tenancy` dry-run then `--apply` on a staging clone; verify counts.  
2. Confirm cross-org IDOR tests on projects/tasks/docs/leads/workflows/chats.  
3. Enable `MULTI_TENANT_ENFORCE=true` only after backfill verification (staging first).  
4. Configure SMTP for invitations and test accept/revoke/replay.  
5. Resolve remaining Phase 1 ops checks before production cutover.  
6. Do **not** enable production enforcement from Phase 2.5.
