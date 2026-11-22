# Chronos V2 — Phase 2 Changelog

**Branch:** `feat/chronos-v2-phase-2`  
**Date:** 2026-11-23

## Models

- Organization, Workspace, Membership, WorkspaceMembership, Invitation, Team (schema foundation)
- Optional `organizationId` / `workspaceId` on Project, Doc, Lead, Workflow, WorkflowExecution, Chat, ActivityLog, Announcement
- User: `platformRole`, `activeOrganizationId`, `activeWorkspaceId`

## Authorization

- Central helpers in `src/lib/tenancy/*` + workspace-aware `src/lib/auth/access.ts`
- Session JWT carries active org/workspace (DB membership remains authoritative)

## Migration

- `npm run migrate:tenancy` (dry-run default; `--apply` to write)
- Feature flag `MULTI_TENANT_ENFORCE` (default off / dual-read)

## APIs

- Organizations, workspaces, invitations, context switch
- Workspace isolation on projects, tasks, docs, leads, workflows, chats, activity, team

## UI

- Sidebar workspace switcher
- `/onboarding`, `/settings/organization`, `/settings/workspace`, `/invite/[token]`

## Env

| Variable | Purpose |
|---|---|
| `MULTI_TENANT_ENFORCE` | `true` to require workspace context |
| `SMTP_*` | Invitation email delivery |
| `NEXTAUTH_URL` / `APP_URL` | Invite link base |

## Known limitations

- Invitation email requires SMTP configuration
- Platform admin tooling not built (field only)
- Team subgroup UI deferred
- Production migration not applied in this phase (operator-run only)
