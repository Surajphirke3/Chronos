# Tenancy Migration

## Command

```bash
npm run migrate:tenancy          # dry-run (default)
npm run migrate:tenancy -- --apply
```

**Never** runs at app startup. Take a MongoDB backup before `--apply`.

## Stages

1. Create default Organization (`migrationKey: chronos-default-organization-v1`)
2. Create default Workspace (`migrationKey: chronos-default-workspace-v1`)
3. Upsert Membership + WorkspaceMembership for every user
4. Set `activeOrganizationId` / `activeWorkspaceId`
5. Backfill `organizationId`/`workspaceId` on projects, docs, leads, workflows, executions, chats, activitylogs
6. Map first legacy admin (else first user) → org/workspace **owner**
7. Map other legacy admins → org/workspace **admin** (not platform_admin)

## Dual-read

Keep `MULTI_TENANT_ENFORCE=false` until counts and isolation are verified, then set `true`.

## Rollback

- Soft: set `MULTI_TENANT_ENFORCE=false` (dual-read resumes)
- Hard: restore MongoDB backup taken before `--apply`
- Do not delete membership collections casually; they are additive

## Idempotency

Safe to re-run. Uses migration keys and upserts; backfill only touches rows missing `workspaceId`.
