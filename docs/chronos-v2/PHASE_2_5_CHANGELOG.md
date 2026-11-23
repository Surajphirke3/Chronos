# Chronos V2 — Phase 2.5 Changelog

**Branch:** `feat/chronos-v2-phase-2`  
**Date:** 2026-11-23  
**Goal:** Independent verification of Phase 2 tenancy; fix verified defects only.

## Defects fixed

1. **Critical — dual-read cross-tenant leak**  
   Unscoped (`workspaceId` null) rows were visible to every active workspace.  
   Now gated by `allowsLegacyUnscopedRead` (default migrated org/workspace only).

2. **High — invitation wrong-email race**  
   Accept rolled back to `pending` after consuming the invite.  
   Now claims with `{ tokenHash, email, status: pending }` atomically.

3. **Medium — invitation preview unthrottled**  
   Added IP rate limit (`invitationPreview`).

4. **Medium — legacy global admin project mutate**  
   `PATCH /api/projects/:id` no longer treats `User.role=admin` as workspace admin.

5. **Medium — AI routes lacked tenant gate under enforce**  
   AI + outreach generate use `requireAiTenantContext()`; outreach also uses AI budget.

## Tests added

- `src/lib/tenancy/dualRead.test.ts`
- Invitation atomic-email source invariant in `invitations.test.ts`

## Docs added

- `TENANCY_STAGING_VERIFICATION.md`
- `TENANT_API_AUDIT_MATRIX.md`
- `AI_TENANT_ISOLATION_AUDIT.md`
- `MIGRATION_VERIFICATION_REPORT.md`

## Not done (by design)

- No production migration
- No enabling `MULTI_TENANT_ENFORCE` globally
- No staging DB apply (requires operator URI + approval)

## Final decision

**B. READY AFTER LISTED FIXES** (fixes applied).  
Staging cutover readiness requires operator migration checklist completion → then **A** for staging enforce only.
