# Chronos V2 — Master Plan

**Phase 0 complete (audit + foundation hardening)**  
**Date:** 2026-11-22

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
| Tenancy | Design now; implement later | Avoid premature schema churn |
| ACL precursor | Project owner/member/admin | Matches existing schema |
| Google auth | Verify Firebase ID token server-side | Closes account takeover |
| Queues | Defer introduction | Fix only if immediate; resume worker is Phase 1 |
| API style | Continue Route Handlers | No parallel Server Actions rewrite |
| Secrets | Redact now; encrypt Phase 1 | Safe incremental hardening |

**Uncertainty:** Org vs Workspace as billing unit — prefer Organization (see MULTI_TENANCY_DESIGN.md).

---

## 4. Phase dependencies

```
Phase 0 (Foundation) ──► Phase 1 (Security & Reliability)
                         ├─► Phase 2 (Multi-tenancy schema + ACL)
                         ├─► Phase 3 (Async workflows / jobs)
                         └─► Phase 4 (Product surface: invites, attachments, polish)
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

1. Organization / Workspace / Membership models  
2. Default tenant backfill  
3. Session active workspace  
4. Enforce workspaceId on queries  
5. Invitations  

### Phase 3 — Async automation

1. Job queue for workflow execution  
2. Durable rate limiting shared across instances  
3. Webhooks (if product still requires n8n-class integrations)  

### Phase 4 — Product expansion

1. Attachments with ACL  
2. Password reset / email verification  
3. Announcements + real notifications  
4. Fine-grained permissions / teams  

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

**Classification: Requires staging verification.**

Before Phase 2 (multi-tenancy):

1. Verify Google Cloud OAuth against real credentials.  
2. Run secrets migration dry-run/`--apply` on a backed-up database.  
3. Configure `/api/cron/workflows/resume` with `CHRONOS_CRON_SECRET`.  
4. Set `ALLOW_PUBLIC_REGISTRATION=false` in staging/production.  
5. Confirm CI green on the feature branch.
