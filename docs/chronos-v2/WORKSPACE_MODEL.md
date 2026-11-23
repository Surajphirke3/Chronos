# Workspace Model

## Fields

- `organizationId` (required)
- `name`, `slug` (unique per organization)
- `description`, `type`, `settings`, `isDefault`
- `status`: `active` | `archived`
- `migrationKey` (sparse unique for default workspace)
- timestamps

## Roles (WorkspaceMembership)

| Role | Capabilities |
|---|---|
| owner | Full workspace administration |
| admin | Settings, membership, workspace resources |
| member | Create/manage resources under existing product ACL |
| guest | Limited; no org admin; restricted directory/sensitive ops |

## Rules

- Workspace membership requires active organization membership.
- Default workspace cannot be archived.
- Tasks inherit workspace via Project (no denormalized `workspaceId` on Task).

## APIs

- `GET/POST /api/workspaces`
- `GET/PATCH /api/workspaces/:id`
- `GET/POST/DELETE /api/workspaces/:id/members`
