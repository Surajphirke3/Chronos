/**
 * Typed permission catalog for Chronos governance (Phase 5 CP1).
 * Finite, explicit identifiers only — no wildcards.
 */

export type PermissionScope = 'organization' | 'workspace' | 'resource'

export const PERMISSIONS = [
  // Organization
  'organization.read',
  'organization.update',
  'organization.delete',
  'organization.settings.manage',
  'organization.transfer',

  // Members
  'members.read',
  'members.invite',
  'members.update',
  'members.remove',
  'members.roles.manage',

  // Workspaces
  'workspaces.read',
  'workspaces.create',
  'workspaces.update',
  'workspaces.delete',
  'workspaces.members.manage',

  // Projects (workspace resource; ACL still applies for member/guest)
  'projects.read',
  'projects.create',
  'projects.update',
  'projects.delete',
  'projects.archive',

  // Tasks
  'tasks.read',
  'tasks.create',
  'tasks.update',
  'tasks.delete',

  // Documents
  'documents.read',
  'documents.create',
  'documents.update',
  'documents.delete',

  // Workflows (outreach)
  'workflows.read',
  'workflows.create',
  'workflows.update',
  'workflows.delete',
  'workflows.execute',

  // Automations / jobs / schedules
  'automations.read',
  'automations.create',
  'automations.update',
  'automations.delete',
  'automations.execute',
  'automations.manage_schedules',

  // Billing (Phase 4) — billing.manage is owner-only; never grant via custom roles
  'billing.read',
  'billing.manage',
  'billing.invoices.read',
  'billing.usage.read',

  // Audit (Phase 5 CP3+)
  'audit.read',
  'audit.export',

  // API keys (Phase 5 CP4+)
  'api_keys.read',
  'api_keys.create',
  'api_keys.revoke',

  // Security policies (Phase 5 CP5+)
  'security.read',
  'security.manage',

  // Data governance (Phase 5 CP6+)
  'data.export',
  'data.retention.manage',
] as const

export type Permission = (typeof PERMISSIONS)[number]

export type PermissionMeta = {
  id: Permission
  namespace: string
  description: string
  scope: PermissionScope
  /** If true, only system org owner map may grant; stripped from extras/custom roles. */
  ownerOnly?: boolean
}

export const PERMISSION_META: Record<Permission, PermissionMeta> = {
  'organization.read': {
    id: 'organization.read',
    namespace: 'organization',
    description: 'View organization profile and membership context',
    scope: 'organization',
  },
  'organization.update': {
    id: 'organization.update',
    namespace: 'organization',
    description: 'Update organization name and settings',
    scope: 'organization',
  },
  'organization.delete': {
    id: 'organization.delete',
    namespace: 'organization',
    description: 'Archive or delete the organization',
    scope: 'organization',
    ownerOnly: true,
  },
  'organization.settings.manage': {
    id: 'organization.settings.manage',
    namespace: 'organization',
    description: 'Manage organization-level settings',
    scope: 'organization',
  },
  'organization.transfer': {
    id: 'organization.transfer',
    namespace: 'organization',
    description: 'Transfer organization ownership',
    scope: 'organization',
    ownerOnly: true,
  },

  'members.read': {
    id: 'members.read',
    namespace: 'members',
    description: 'List organization members',
    scope: 'organization',
  },
  'members.invite': {
    id: 'members.invite',
    namespace: 'members',
    description: 'Invite members to the organization or workspace',
    scope: 'organization',
  },
  'members.update': {
    id: 'members.update',
    namespace: 'members',
    description: 'Update member profiles within policy',
    scope: 'organization',
  },
  'members.remove': {
    id: 'members.remove',
    namespace: 'members',
    description: 'Remove organization members',
    scope: 'organization',
  },
  'members.roles.manage': {
    id: 'members.roles.manage',
    namespace: 'members',
    description: 'Assign organization roles (owner assignment still owner-gated)',
    scope: 'organization',
  },

  'workspaces.read': {
    id: 'workspaces.read',
    namespace: 'workspaces',
    description: 'View workspaces the user belongs to',
    scope: 'organization',
  },
  'workspaces.create': {
    id: 'workspaces.create',
    namespace: 'workspaces',
    description: 'Create workspaces in the organization',
    scope: 'organization',
  },
  'workspaces.update': {
    id: 'workspaces.update',
    namespace: 'workspaces',
    description: 'Update workspace settings',
    scope: 'workspace',
  },
  'workspaces.delete': {
    id: 'workspaces.delete',
    namespace: 'workspaces',
    description: 'Archive or delete a workspace',
    scope: 'workspace',
  },
  'workspaces.members.manage': {
    id: 'workspaces.members.manage',
    namespace: 'workspaces',
    description: 'Add or remove workspace members',
    scope: 'workspace',
  },

  'projects.read': {
    id: 'projects.read',
    namespace: 'projects',
    description: 'Read projects subject to workspace + project ACL',
    scope: 'resource',
  },
  'projects.create': {
    id: 'projects.create',
    namespace: 'projects',
    description: 'Create projects in the workspace',
    scope: 'workspace',
  },
  'projects.update': {
    id: 'projects.update',
    namespace: 'projects',
    description: 'Update projects subject to ACL / workspace admin',
    scope: 'resource',
  },
  'projects.delete': {
    id: 'projects.delete',
    namespace: 'projects',
    description: 'Delete projects subject to ACL / workspace admin',
    scope: 'resource',
  },
  'projects.archive': {
    id: 'projects.archive',
    namespace: 'projects',
    description: 'Archive projects',
    scope: 'resource',
  },

  'tasks.read': {
    id: 'tasks.read',
    namespace: 'tasks',
    description: 'Read tasks in accessible projects',
    scope: 'resource',
  },
  'tasks.create': {
    id: 'tasks.create',
    namespace: 'tasks',
    description: 'Create tasks in accessible projects',
    scope: 'resource',
  },
  'tasks.update': {
    id: 'tasks.update',
    namespace: 'tasks',
    description: 'Update tasks in accessible projects',
    scope: 'resource',
  },
  'tasks.delete': {
    id: 'tasks.delete',
    namespace: 'tasks',
    description: 'Delete tasks in accessible projects',
    scope: 'resource',
  },

  'documents.read': {
    id: 'documents.read',
    namespace: 'documents',
    description: 'Read documents in accessible projects',
    scope: 'resource',
  },
  'documents.create': {
    id: 'documents.create',
    namespace: 'documents',
    description: 'Create documents in accessible projects',
    scope: 'resource',
  },
  'documents.update': {
    id: 'documents.update',
    namespace: 'documents',
    description: 'Update documents in accessible projects',
    scope: 'resource',
  },
  'documents.delete': {
    id: 'documents.delete',
    namespace: 'documents',
    description: 'Delete documents in accessible projects',
    scope: 'resource',
  },

  'workflows.read': {
    id: 'workflows.read',
    namespace: 'workflows',
    description: 'List and view outreach workflows',
    scope: 'workspace',
  },
  'workflows.create': {
    id: 'workflows.create',
    namespace: 'workflows',
    description: 'Create outreach workflows',
    scope: 'workspace',
  },
  'workflows.update': {
    id: 'workflows.update',
    namespace: 'workflows',
    description: 'Update outreach workflows',
    scope: 'workspace',
  },
  'workflows.delete': {
    id: 'workflows.delete',
    namespace: 'workflows',
    description: 'Delete outreach workflows',
    scope: 'workspace',
  },
  'workflows.execute': {
    id: 'workflows.execute',
    namespace: 'workflows',
    description: 'Execute outreach workflows',
    scope: 'workspace',
  },

  'automations.read': {
    id: 'automations.read',
    namespace: 'automations',
    description: 'View jobs and automation status',
    scope: 'workspace',
  },
  'automations.create': {
    id: 'automations.create',
    namespace: 'automations',
    description: 'Enqueue automation jobs',
    scope: 'workspace',
  },
  'automations.update': {
    id: 'automations.update',
    namespace: 'automations',
    description: 'Update automation configuration',
    scope: 'workspace',
  },
  'automations.delete': {
    id: 'automations.delete',
    namespace: 'automations',
    description: 'Delete automation configuration',
    scope: 'workspace',
  },
  'automations.execute': {
    id: 'automations.execute',
    namespace: 'automations',
    description: 'Run or retry automation jobs',
    scope: 'workspace',
  },
  'automations.manage_schedules': {
    id: 'automations.manage_schedules',
    namespace: 'automations',
    description: 'Create and manage automation schedules',
    scope: 'workspace',
  },

  'billing.read': {
    id: 'billing.read',
    namespace: 'billing',
    description: 'View subscription and billing overview',
    scope: 'organization',
  },
  'billing.manage': {
    id: 'billing.manage',
    namespace: 'billing',
    description: 'Checkout, change plan, cancel (organization owner only)',
    scope: 'organization',
    ownerOnly: true,
  },
  'billing.invoices.read': {
    id: 'billing.invoices.read',
    namespace: 'billing',
    description: 'View invoices and payment history',
    scope: 'organization',
  },
  'billing.usage.read': {
    id: 'billing.usage.read',
    namespace: 'billing',
    description: 'View organization usage meters',
    scope: 'organization',
  },

  'audit.read': {
    id: 'audit.read',
    namespace: 'audit',
    description: 'View organization audit events',
    scope: 'organization',
  },
  'audit.export': {
    id: 'audit.export',
    namespace: 'audit',
    description: 'Export audit history',
    scope: 'organization',
  },

  'api_keys.read': {
    id: 'api_keys.read',
    namespace: 'api_keys',
    description: 'List API keys (prefixes only)',
    scope: 'organization',
  },
  'api_keys.create': {
    id: 'api_keys.create',
    namespace: 'api_keys',
    description: 'Create organization API keys',
    scope: 'organization',
  },
  'api_keys.revoke': {
    id: 'api_keys.revoke',
    namespace: 'api_keys',
    description: 'Revoke organization API keys',
    scope: 'organization',
  },

  'security.read': {
    id: 'security.read',
    namespace: 'security',
    description: 'View organization security policies',
    scope: 'organization',
  },
  'security.manage': {
    id: 'security.manage',
    namespace: 'security',
    description: 'Update organization security policies',
    scope: 'organization',
    ownerOnly: true,
  },

  'data.export': {
    id: 'data.export',
    namespace: 'data',
    description: 'Request organization data exports',
    scope: 'organization',
  },
  'data.retention.manage': {
    id: 'data.retention.manage',
    namespace: 'data',
    description: 'Manage retention settings (apply still flagged)',
    scope: 'organization',
    ownerOnly: true,
  },
}

const PERMISSION_SET = new Set<string>(PERMISSIONS)

export function isPermission(value: string): value is Permission {
  return PERMISSION_SET.has(value)
}

export function assertValidPermission(value: string): Permission {
  if (!isPermission(value)) {
    throw new Error(`Invalid permission identifier: ${value}`)
  }
  return value
}

export function listPermissions(): Permission[] {
  return [...PERMISSIONS]
}

export function getPermissionMeta(permission: Permission): PermissionMeta {
  return PERMISSION_META[permission]
}

/** Permissions that must never be granted by custom roles or client extras. */
export function isOwnerOnlyPermission(permission: Permission): boolean {
  return Boolean(PERMISSION_META[permission].ownerOnly)
}
