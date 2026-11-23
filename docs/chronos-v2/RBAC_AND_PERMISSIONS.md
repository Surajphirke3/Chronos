# RBAC and Permissions (Phase 2)

## Layers

1. **Platform** — `User.platformRole === platform_admin` (explicit only).
2. **Organization** — Membership.role (`owner` | `admin` | `member`).
3. **Workspace** — WorkspaceMembership.role (`owner` | `admin` | `member` | `guest`).
4. **Resource** — Existing project owner/members arrays (preserved).

## Helpers

`src/lib/tenancy/context.ts`

- `requireAuthenticatedUser`
- `getActiveTenantContext`
- `requireOrganizationAccess`
- `requireWorkspaceAccess`
- `workspaceScopedFilter`
- `accessOptionsFromTenant`

`src/lib/auth/access.ts`

- Workspace-aware `canAccessProject` / `projectVisibilityFilter` / `findAccessibleProject`

## Escalation prevention

- Invitations cannot assign `owner` unless actor is owner (org) / owner (workspace).
- Org invitations never grant `platform_admin`.
- Team PATCH no longer mutates global `User.role`.
