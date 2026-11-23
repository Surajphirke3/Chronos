# Migration Verification Report (Phase 2.5)

## Script review (`scripts/migrate-tenancy.ts`)

| Property | Status |
|---|---|
| Dry-run default | Yes (mutations only with `--apply`) |
| Idempotent keys | `chronos-default-organization-v1`, `chronos-default-workspace-v1` |
| Duplicate memberships | Upsert on `(organizationId,userId)` / `(workspaceId,userId)` |
| Destructive deletes | None |
| Secrets in logs | No (counts + ids only) |
| Auto-run on startup | No |
| Platform admin promotion | Explicitly avoided (`platformRole` stays `none`) |
| Owner selection | First legacy admin by `createdAt`, else first user |

## Staging-only execution checklist

**Do not run against production.**

1. Create a MongoDB **clone** of staging (or restore backup into a scratch DB).
2. Set `MONGODB_URI` to the clone only.
3. Record before counts:
   - `users`, `projects`, `docs`, `leads`, `workflows`, `workflowexecutions`, `chats`, `activitylogs`
   - documents missing `workspaceId`
4. `npm run migrate:tenancy` (dry-run) — save JSON summary.
5. Take a fresh dump of the clone.
6. `npm run migrate:tenancy -- --apply` — save JSON summary.
7. After counts:
   - Every user has Membership + WorkspaceMembership in default org/WS
   - Missing-`workspaceId` counts ≈ 0 for backfilled collections
   - Exactly one org/workspace with migration keys
   - Exactly one Membership with `role: owner`
8. Referential checks:
   - Sample projects: `workspaceId` → workspace.organizationId matches project.organizationId
   - Tasks still point at existing projects
   - No duplicate Membership pairs
9. Idempotency: re-run dry-run; expected create flags false; backfill counts 0.
10. Functional smoke: login as migrated user → `/api/context` returns default org/WS → list projects.
11. Isolation smoke: create second org via API → confirm dual-read does **not** show default-tenant unscoped rows for the new org (Phase 2.5 fix).
12. Only after signed approval: consider `MULTI_TENANT_ENFORCE=true` on staging.

## Execution status in this Phase 2.5 pass

| Step | Result |
|---|---|
| Script code review | Completed |
| Dry-run / apply on staging clone | **Not executed** (no staging DB URI / no operator approval in this session) |
| Production apply | **Forbidden / not performed** |

## Recommendation

Migration script is structurally safe for staging clone apply. Operator must still execute the checklist and attach real before/after counts to this report before cutover.
