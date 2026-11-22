# Chronos V2 — Phase 5 RBAC (Checkpoint 1)

**Branch:** `feat/chronos-v2-phase-5`  
**Status:** Permission catalog + evaluation foundation (no route migration)

---

## 1. Permission catalog

Source: `src/lib/governance/permissions/catalog.ts`

Finite TypeScript literal permissions (no wildcards). Namespaces:

| Namespace | Examples |
|---|---|
| organization | read, update, delete, settings.manage, transfer |
| members | read, invite, update, remove, roles.manage |
| workspaces | read, create, update, delete, members.manage |
| projects / tasks / documents | CRUD (+ projects.archive) |
| workflows | read, create, update, delete, execute |
| automations | read, create, update, delete, execute, manage_schedules |
| billing | read, manage, invoices.read, usage.read |
| audit | read, export |
| api_keys | read, create, revoke |
| security | read, manage |
| data | export, retention.manage |

**Owner-only permissions** (never grantable via custom-role extras):

- `billing.manage`
- `organization.delete`
- `organization.transfer`
- `security.manage`
- `data.retention.manage`

---

## 2. System role compatibility matrix

### Organization roles

| Permission | owner | admin | member |
|---|---|---|---|
| organization.read | ✓ | ✓ | ✓ |
| organization.update / settings.manage | ✓ | ✓ | |
| organization.delete / transfer | ✓ | | |
| members.* (invite/update/remove/roles) | ✓ | ✓ | read only |
| workspaces.create | ✓ | ✓ | |
| workspaces.read | ✓ | ✓ | ✓ |
| billing.read / invoices / usage | ✓ | ✓ | |
| billing.manage | ✓ | | |
| audit.* | ✓ | ✓ | |
| api_keys.* | ✓ | ✓ | |
| security.read | ✓ | ✓ | |
| security.manage | ✓ | | |
| data.export | ✓ | ✓ | |
| data.retention.manage | ✓ | | |

### Workspace roles (requires verified workspace membership)

| Permission | owner | admin | member | guest |
|---|---|---|---|---|
| workspaces.read | ✓ | ✓ | ✓ | ✓ |
| workspaces.update/delete/members.manage | ✓ | ✓ | | |
| projects/tasks/documents read | ✓ | ✓ | ✓ | ✓ |
| projects/tasks/documents mutate | ✓ | ✓ | ✓ | |
| workflows.* | ✓ | ✓ | ✓ | |
| automations read/create/execute | ✓ | ✓ | ✓ | |
| automations manage_schedules / update / delete | ✓ | ✓ | | |

**Resource ACL:** For workspace `member` / `guest`, `projects.*` / `tasks.*` / `documents.*` still require `canAccessProject` (owner/members arrays or workspace admin). Permission grants are necessary but not sufficient.

---

## 3. Evaluation semantics

Module: `src/lib/governance/permissions/evaluate.ts`

```ts
getEffectivePermissions(actor)
hasPermission(actor, permission, { resourceOrganizationId?, resourceWorkspaceId? })
assertPermission(actor, permission, options?) // AppError 403
permissionActorFromTenant(ctx)
hasPlatformAdminRole / assertPlatformAdmin
```

Rules:

1. Actor must come from server-validated membership (`TenantContext`), not client claims.
2. No `organizationId` / `orgRole` ⇒ empty permission set.
3. Union org-role map + workspace-role map + sanitized extras.
4. Owner-only permissions stripped unless `orgRole === 'owner'`.
5. `platformRole` never adds org permissions.
6. Legacy `User.role` never adds org permissions.
7. Cross-org / cross-workspace resource IDs deny.

---

## 4. Billing and platform safeguards

- `billing.manage` → organization **owner** only.
- Custom extras cannot add `billing.manage`.
- Platform admin (`User.platformRole === 'platform_admin'`) is orthogonal; use `hasPlatformAdminRole`.
- Legacy `User.role` is never mapped to platform or billing privileges.

Phase 4 billing APIs are not implemented in CP1; the catalog encodes the approved policy for when they land.

---

## 5. Feature flag

`GOVERNANCE_ENFORCEMENT_ENABLED` (default **false**).

- Does **not** disable tenancy isolation or existing role helpers.
- Controls gradual adoption of permission checks on new/migrated surfaces.
- CP1 does not flip any production routes to require the flag.

Helpers: `src/lib/governance/flags.ts`.

---

## 6. Authorization paths — CP1 status

### Deliberately unchanged (still authoritative)

| Path | Mechanism |
|---|---|
| Org/workspace gates | `requireOrganizationAccess`, `requireWorkspaceAccess` |
| Role rank | `orgRoleAtLeast`, `workspaceRoleAtLeast` |
| Projects/tasks/docs | `canAccessProject`, `projectVisibilityFilter` |
| Invitations | `canAssignOrgRole` / `canAssignWorkspaceRole` |
| Ownership transfer | `requireOrganizationAccess(..., 'owner')` |
| Jobs / workflows / leads | Existing workspace role checks in route handlers |
| AI budgets | `assertAiBudget` (usage, not RBAC) |

### Available for new surfaces / later migration

- `hasPermission` / `assertPermission` for governance APIs (roles, audit, API keys, security, export) in later checkpoints.
- Optional dual-check under `GOVERNANCE_ENFORCEMENT_ENABLED` in a future hardening checkpoint — **not** enabled in CP1.

---

## 7. Known limitations

- Custom roles not implemented (CP2); `extraPermissions` is the forward-compatible hook.
- Catalog includes planned Phase 4/5 permissions before those UIs exist.
- MFA unsupported — no permission implies MFA.
- Effective permissions do not replace project ACL.
- No wildcard permissions.

---

## 8. Tests

`src/lib/governance/permissions/evaluate.test.ts` — catalog, system roles, isolation, billing owner-only, legacy/platform separation, project ACL compatibility, flag default.
