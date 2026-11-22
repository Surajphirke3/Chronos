# Chronos V2 — API & Input Validation Audit

**Phase:** 0  
**Date:** 2026-11-22

All APIs are Next.js Route Handlers under `src/app/api`. No Server Actions.

---

## Inventory summary

| Area | Auth | Authz | Validation | Notes |
|------|------|-------|------------|-------|
| auth/register | public | n/a | manual + rate limit | `ALLOW_PUBLIC_REGISTRATION` gate |
| auth/[...nextauth] | NextAuth | n/a | NextAuth | |
| projects | session | membership | allowlist POST/PATCH | Phase 0 hardened |
| tasks | session | via project | allowlist | Phase 0 hardened |
| docs | session | author/project | allowlist | Phase 0 hardened |
| activity | session | scoped | limit capped 1–100 | Phase 0 |
| team | session | PATCH admin | weak role enum | |
| user/settings | session | self | secret skip-if-blank | Phase 0 redact |
| chats | session | participants | partial | |
| leads / import | session | owner | file size/rows Phase 0 | |
| workflows | session | owner | PATCH allowlist | Phase 0 |
| workflows/execute | session | owner | partial | sync long-running |
| outreach/* | session | owner / n/a | manual | |
| ai/* | session | n/a | chat allowlist+rate | SSRF mitigated |

---

## Cross-cutting evaluation

| Concern | Status |
|---------|--------|
| Input validation | Partial — allowlists + required fields; Zod schemas deferred |
| Type safety | TS `strict: false`; runtime validation incomplete |
| Auth requirements | Present on business APIs |
| Authorization | Hardened for workspace resources Phase 0 |
| Request size limits | Lead import 5MB; Next.js body defaults otherwise; `next.config.ts` empty |
| Rate limiting | Register + AI chat (in-memory) |
| Pagination | Mostly absent (activity has limit) |
| Filtering / sorting | Ad-hoc query params |
| Error handling | try/catch + generic 500 |
| Transactions | Not used |
| Sensitive leakage | Settings secrets redacted; workflow config may still contain secrets if stored |
| Response consistency | Mixed array vs wrapped objects |

---

## IDOR status

| Endpoint family | Pre–Phase 0 | Post–Phase 0 |
|-----------------|-------------|--------------|
| projects | Global IDOR | Membership/admin |
| tasks | Global IDOR | Project access |
| docs | Global IDOR | Author/project/admin |
| activity | Global | Scoped |
| workflows/leads | Owner OK | Owner OK |
| chats | Participant OK | Participant OK |

---

## Reusable patterns introduced

- `src/lib/auth/access.ts` — visibility filter, membership check, field allowlists, secret helpers
- `src/lib/security/rateLimit.ts` — in-process limiter
- Do **not** create a parallel API framework; extend these helpers

---

## Recommended Phase 1 API work

1. Zod schemas per route; shared `apiError` / `apiOk` helpers
2. Cursor pagination for messages, leads, activity
3. Durable rate limiting (Redis)
4. Strip secrets from workflow GET responses
5. Request body size limits in `next.config.ts`
