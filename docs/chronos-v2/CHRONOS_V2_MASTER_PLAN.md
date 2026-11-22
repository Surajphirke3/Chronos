# Chronos V2 — Master Plan

**Phase 0–2.5 complete (staging ops remaining) · Phase 3 automation implemented with limitations · Phase 4 billing models started · Phase 5 governance architecture proposed**  
**Date:** 2026-11-23

---

## 1. Verified current capabilities

- Next.js 16 App Router monolith with MongoDB/Mongoose
- Credentials auth + Firebase Google (server token verify)
- Projects, tasks (Kanban), docs (TipTap), messaging (polling), team directory
- User settings for Gmail SMTP + AI keys (redacted on read)
- Outreach: lead import, workflow builder, synchronous execute, stats/monitor
- AI tools: summarize, PRD writer (stream), generate-tasks (env Groq)
- i18n + theme
- Membership-based project ACL (Phase 0)

---

## 2. Verified gaps

| Gap | Impact |
|-----|--------|
| No Organization/Workspace tenancy | Blocks multi-tenant BOS |
| Paused workflows never resume | Outreach sequences incomplete |
| Sync execute in HTTP | Timeouts / poor scale |
| Secrets plaintext at rest | Compliance / breach risk |
| No password reset / email verify | Auth incompleteness |
| No invites; open registration risk | Tenant contamination |
| No CI, Docker, health checks | Delivery risk |
| Thin automated tests | Regression risk |
| README overclaims (n8n, Server Actions, AI SDK) | Trust / onboarding |
| Announcements / notifications stubs | Product polish |

---

## 3. Architectural decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Stack | Keep Next.js + Mongoose + NextAuth | Non-negotiable Phase 0 rule |
| Tenancy | Organization + Workspace + Memberships | Implemented Phase 2; dual-read until enforce |
| ACL precursor | Project owner/member/admin | Matches existing schema |
| Google auth | Verify Firebase ID token server-side | Closes account takeover |
| Queues | Defer introduction | Fix only if immediate; resume worker is Phase 1 |
| API style | Continue Route Handlers | No parallel Server Actions rewrite |
| Secrets | Redact now; encrypt Phase 1 | Safe incremental hardening |

**Billing unit:** Organization (locked; see Phase 4 architecture).  
**Governance:** Organization-scoped custom roles + immutable audit + API keys (Phase 5; architecture pending review).

---

## 4. Phase dependencies

```
Phase 0 (Foundation) ──► Phase 1 (Security & Reliability)
                         ├─► Phase 2 (Multi-tenancy schema + ACL)
                         ├─► Phase 3 (Async workflows / jobs)
                         ├─► Phase 4 (Billing / subscriptions / usage — in progress)
                         ├─► Phase 5 (Enterprise governance & security — architecture)
                         └─► Later product expansion (attachments, notifications, polish)
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

**Status: CP1 complete on `feat/chronos-v2-phase-5` (catalog + evaluation; routes unchanged). CP2+ pending.**

1. [x] Permission catalog + evaluation (compat with existing roles) — `PHASE_5_RBAC.md`  
2. [ ] Organization custom roles  
3. [ ] Immutable `AuditEvent` + dashboard  
4. [ ] Organization API keys (hashed secrets, scopes)  
5. [ ] Organization security policies (no fake MFA)  
6. [ ] Data export / retention via Phase 3 jobs  
7. [ ] Platform governance controls (`platformRole` only)  
8. [ ] Hardening, migration dry-run, docs, staging flags off by default  

See `docs/chronos-v2/PHASE_5_ARCHITECTURE.md`.

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
