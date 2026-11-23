# Multi-Tenancy Architecture (Phase 2)

## Entities

```
User (global identity)
  └── Membership ──► Organization
        └── Workspace
              └── WorkspaceMembership
              └── Invitation (org or workspace scope)
              └── Projects, Docs, Leads, Workflows, Chats, ActivityLogs
```

- **User** is global; never owns a single org via `organizationId` on User.
- **Organization** is the legal/billing boundary (billing not implemented).
- **Workspace** is the operational isolation boundary for business data.
- **Membership** / **WorkspaceMembership** are the only access relationships.
- **Invitation** stores `tokenHash` only; raw tokens never persisted.

## Active context

- Stored on User: `activeOrganizationId`, `activeWorkspaceId`.
- Mirrored into JWT/session for UX; **authorization always re-checks DB membership**.
- Switch via `POST /api/context` after membership verification.

## Enforcement flag

| `MULTI_TENANT_ENFORCE` | Behavior |
|---|---|
| `false` (default) | Dual-read: verified workspace scope + legacy rows missing `workspaceId` |
| `true` | Require active workspace membership; reject unscoped legacy access |

## Platform vs org admin

- `User.role` remains legacy (`admin`/`member`) for compatibility.
- `User.platformRole` (`none` | `platform_admin`) is explicit and never granted by invitations.
- Migration maps legacy `User.role=admin` → **default org admin**, not platform admin.

## Query rule

Never trust client `workspaceId` alone. Resolve verified tenant context, then query with `workspaceScopedFilter` / project ACL.
