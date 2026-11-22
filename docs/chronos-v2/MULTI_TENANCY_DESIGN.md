# Chronos V2 — Multi-Tenancy Design

**Status:** Design only — **not implemented** in Phase 0.  
**Date:** 2026-11-22

---

## Current state

Chronos behaves as a **single shared application** with:

- Global `User` directory (`/api/team`)
- Project collaboration via `ownerId` + `members`
- User-owned outreach (`Lead`, `Workflow`, `WorkflowExecution.ownerId`)
- Participant-scoped chats
- App-wide `User.role` (`admin` | `member`)

There are **no** Organization, Workspace, Membership, Invitation, Team, or Permission collections.

---

## Proposed concepts

| Concept | Purpose |
|---------|---------|
| **Organization** | Billing / legal tenant boundary (company) |
| **Workspace** | Operational boundary (team space inside an org) |
| **Membership** | User ↔ Organization with org-level role |
| **WorkspaceMembership** | User ↔ Workspace with workspace role |
| **Team** | Optional subgroup inside a workspace |
| **Role** | Named role (owner, admin, member, guest) |
| **Permission** | Fine-grained capability strings (or role→permission map) |
| **Invitation** | Email invite to org/workspace with expiry + token |
| **Project ownership** | Projects belong to a workspace; `ownerId` remains the creating user |

---

## Data ownership matrix

| Entity | Global | Organization | Workspace | User |
|--------|--------|--------------|-----------|------|
| User (identity) | profile identity | via Membership | via WorkspaceMembership | self |
| UserSettings | — | — | — | **user** (optionally org-policy constrained) |
| Organization | — | **self** | — | — |
| Workspace | — | parent org | **self** | — |
| Membership | — | **org** | — | user ref |
| WorkspaceMembership | — | — | **workspace** | user ref |
| Invitation | — | org and/or workspace | optional | inviter |
| Team | — | — | **workspace** | — |
| Role / Permission | system catalog (global) | custom roles optional | — | — |
| Project | — | — | **required** | owner + members |
| Task | — | — | via project | assignee |
| Doc | — | — | **required** | author |
| Lead | — | optional shared CRM | **default** | owner (rep) |
| Workflow / Execution | — | — | **required** | owner |
| Chat / Message | — | — | **required** | participants |
| ActivityLog | platform-only events | org audit optional | **workspace feed** | actor |
| Announcement | product-wide | **tenant** | optional | author |

**Do not** add `organizationId`/`workspaceId` to every collection blindly. Prefer workspace scope for collaboration entities; keep User global with join tables.

---

## Entities needing tenant keys

| Entity | Add `organizationId`? | Add `workspaceId`? |
|--------|----------------------|--------------------|
| Project, Task*, Doc, Lead, Workflow, WorkflowExecution, Chat, Message, ActivityLog | optional denorm | **yes** |
| UserSettings | optional | no (user-owned) |
| Announcement | yes (or null = global) | optional |
| User | no | no |
| Membership | yes | no |
| WorkspaceMembership / Invitation / Team | yes | yes where applicable |

\*Task may inherit workspace via `projectId` only (avoid denormalized workspaceId unless query patterns require it).

---

## Tenant isolation strategy

1. **Every query** for workspace-scoped data includes `workspaceId` from the verified server session context (never from untrusted client alone).
2. Session carries `activeOrganizationId` + `activeWorkspaceId` after membership check.
3. Middleware / helper `requireWorkspaceAccess(permission)` wraps mutations.
4. Compound indexes: `{ workspaceId: 1, ...existing }`.
5. Cross-tenant access prevention: reject if resource.workspaceId ≠ session workspace; admins are **org/workspace admins**, not global superusers (except platform ops).

---

## Migration strategy

### Phase approach

1. Introduce collections: Organization, Workspace, Membership, WorkspaceMembership, Invitation.
2. Create a **default organization + workspace** per existing deployment.
3. Backfill: assign all existing Projects/Docs/Chats/Leads/Workflows to default workspace.
4. Convert global `User.role=admin` into org-level admin for that default org.
5. Dual-read period: APIs accept missing workspaceId as default workspace.
6. Enforce workspaceId required; remove dual-read.
7. Enable multi-workspace creation + invitations.

### Existing data backfill

```
for each existing User → ensure Membership(defaultOrg)
create Workspace "Default" under defaultOrg
for each Project/Doc/Lead/Workflow/Chat/ActivityLog → set workspaceId = Default
Project.members → WorkspaceMembership + keep project.members for project ACL
```

### Backward compatibility

- Single-workspace tenants see no UX change if UI hides org switcher.
- `ALLOW_PUBLIC_REGISTRATION=false` recommended once invites exist.

### Rollback

- Keep old fields (`ownerId`, `members`) intact.
- Feature-flag `MULTI_TENANT_ENFORCE`.
- Rollback = disable flag + stop writing new tenant fields (data remains compatible).

---

## Uncertainty (documented, not assumed)

1. **Billing owner:** Organization vs Workspace — undecided; prefer Organization.
2. **Cross-workspace project sharing:** out of scope initially; clone or move only.
3. **Outreach data:** workspace-private vs org-shared CRM — default workspace-private.
4. **Platform super-admin:** may need a separate `platformRole` on User — not designed in detail yet.

---

## Phase 0 stance

No tenant fields were added to production models in Phase 0 (except non-breaking indexes). Membership-based project ACL is a **prerequisite pattern** for workspace ACL later.
