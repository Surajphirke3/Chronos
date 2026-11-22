import type { OrgRole, WorkspaceRole } from '@/lib/tenancy/roles'
import type { Permission } from './catalog'

/**
 * System role → permission maps.
 * Designed to mirror current Chronos authorization semantics (Phase 2/3 routes),
 * plus planned Phase 4/5 capabilities that are not yet wired to routes.
 *
 * Resource ACL (canAccessProject) remains authoritative for project/task/doc
 * access for member/guest — these permissions are necessary but not sufficient.
 */

const ORG_MEMBER: Permission[] = [
  'organization.read',
  'members.read',
  'workspaces.read',
]

const ORG_ADMIN: Permission[] = [
  ...ORG_MEMBER,
  'organization.update',
  'organization.settings.manage',
  'members.invite',
  'members.update',
  'members.remove',
  'members.roles.manage',
  'workspaces.create',
  'billing.read',
  'billing.invoices.read',
  'billing.usage.read',
  'audit.read',
  'audit.export',
  'api_keys.read',
  'api_keys.create',
  'api_keys.revoke',
  'security.read',
  'data.export',
]

const ORG_OWNER: Permission[] = [
  ...ORG_ADMIN,
  'organization.delete',
  'organization.transfer',
  'billing.manage',
  'security.manage',
  'data.retention.manage',
]

/** Workspace guest: can enter workspace context; resource access still ACL-gated. */
const WS_GUEST: Permission[] = [
  'workspaces.read',
  'projects.read',
  'tasks.read',
  'documents.read',
]

/** Workspace member: create/operate on resources; ACL for non-admin updates. */
const WS_MEMBER: Permission[] = [
  ...WS_GUEST,
  'projects.create',
  'projects.update',
  'projects.delete',
  'projects.archive',
  'tasks.create',
  'tasks.update',
  'tasks.delete',
  'documents.create',
  'documents.update',
  'documents.delete',
  'workflows.read',
  'workflows.create',
  'workflows.update',
  'workflows.delete',
  'workflows.execute',
  'automations.read',
  'automations.create',
  'automations.execute',
]

const WS_ADMIN: Permission[] = [
  ...WS_MEMBER,
  'workspaces.update',
  'workspaces.delete',
  'workspaces.members.manage',
  'automations.update',
  'automations.delete',
  'automations.manage_schedules',
]

const WS_OWNER: Permission[] = [...WS_ADMIN]

export const ORG_ROLE_PERMISSIONS: Record<OrgRole, readonly Permission[]> = {
  member: ORG_MEMBER,
  admin: ORG_ADMIN,
  owner: ORG_OWNER,
}

export const WORKSPACE_ROLE_PERMISSIONS: Record<WorkspaceRole, readonly Permission[]> = {
  guest: WS_GUEST,
  member: WS_MEMBER,
  admin: WS_ADMIN,
  owner: WS_OWNER,
}

export function permissionsForOrgRole(role: OrgRole | null | undefined): Permission[] {
  if (!role || !(role in ORG_ROLE_PERMISSIONS)) return []
  return [...ORG_ROLE_PERMISSIONS[role]]
}

export function permissionsForWorkspaceRole(role: WorkspaceRole | null | undefined): Permission[] {
  if (!role || !(role in WORKSPACE_ROLE_PERMISSIONS)) return []
  return [...WORKSPACE_ROLE_PERMISSIONS[role]]
}
