# Organization Model

## Fields

- `name`, `slug` (unique), `description`, `logoUrl`
- `status`: `active` | `archived`
- `createdBy`, `settings`, `migrationKey` (sparse unique)
- timestamps

## Roles (Membership)

| Role | Capabilities |
|---|---|
| owner | Full admin; transfer ownership; cannot be removed silently |
| admin | Manage members (not owner), workspaces, settings |
| member | Access permitted workspaces only |

## APIs

- `GET/POST /api/organizations`
- `GET/PATCH /api/organizations/:id`
- `GET/DELETE /api/organizations/:id/members`
- `POST /api/organizations/:id/transfer`
