# Tenancy Staging Verification (Phase 2.5)

## Decision

**B. READY AFTER LISTED FIXES** → fixes from this pass are now in the branch.

Remaining before **A. READY FOR STAGING CUTOVER**:

1. Operator runs `migrate:tenancy` dry-run + `--apply` on a **staging clone** and records counts.
2. Staging cross-org IDOR smoke (two orgs, swap IDs).
3. SMTP invitation E2E on staging.
4. Explicit approval before `MULTI_TENANT_ENFORCE=true` on staging (not production).

Production enforcement remains **disabled**.

## Feature flag behavior

| Behavior | `MULTI_TENANT_ENFORCE=false` | `=true` |
|---|---|---|
| Authentication required | Yes | Yes |
| Membership re-checked from DB | Yes | Yes |
| Active workspace required | Soft (legacy owner paths if no WS) | Hard 403 |
| Unscoped legacy rows readable | **Only** default migrated tenant (`allowsLegacyUnscopedRead`) | Never |
| Client `workspaceId` trusted alone | No | No |
| Legacy `User.role=admin` global mutate | Removed for project PATCH | N/A |

**false does not bypass auth or membership.** It only widens reads for the default migrated workspace to include pre-backfill null `workspaceId` rows.

## Context switching (code review)

| Scenario | Expected | Verified in code |
|---|---|---|
| Switch WS in same org | `requireWorkspaceAccess` + update User active IDs | Yes |
| Switch to other org WS | Same; org derived from workspace | Yes |
| Switch without membership | 403 | Yes |
| Stale JWT active IDs | DB membership is authoritative | Yes |
| Revoked membership | Access fails; remove clears active IDs | Yes |
| Archived workspace | `status: active` filter rejects | Yes |
| Client cache after switch | `router.refresh()`; APIs re-resolve context | UI best-effort; server authoritative |
| Cron worker | Uses execution owner, not user session | Yes |

## Invitation security (code + unit)

| Case | Result |
|---|---|
| Expired | Atomic claim requires `expiresAt > now` |
| Revoked | Status not `pending` → reject |
| Replay | Status `accepted` → reject |
| Wrong email | **Fixed:** email in atomic filter; no consume/rollback race |
| Duplicate pending | 409 on create |
| SMTP failure | Invite revoked; API error |
| Preview abuse | **Fixed:** IP rate limit |
| Concurrent accept | Single `findOneAndUpdate` winner |

## Verification commands executed

```
npm run test       → 50/50 pass
npm run typecheck  → pass
npm run lint       → pass (0 errors, 4 pre-existing warnings)
npm run build      → pass
```

## Fixes shipped in Phase 2.5

1. Dual-read cross-tenant leak closed (`allowsLegacyUnscopedRead`).
2. Invitation accept email atomic claim.
3. Invitation preview rate limit.
4. Project PATCH no longer uses legacy global admin.
5. AI/outreach generate require tenant context when enforce is on; outreach gains AI budget.
