import { AppError } from '@/lib/api/errors'
import type { OrgRole, WorkspaceRole } from '@/lib/tenancy/roles'
import {
  assertValidPermission,
  isOwnerOnlyPermission,
  isPermission,
  type Permission,
} from './catalog'
import { permissionsForOrgRole, permissionsForWorkspaceRole } from './systemMaps'

/**
 * Actor snapshot for permission evaluation.
 * Must be built from server-validated tenant context — never from client claims.
 */
export type PermissionActor = {
  userId: string
  /** Established platformRole only — never legacy User.role */
  platformRole?: string
  /** Legacy User.role — ignored for permission grants */
  legacyRole?: string
  organizationId: string | null
  workspaceId?: string | null
  orgRole: OrgRole | null
  workspaceRole: WorkspaceRole | null
  /**
   * Future custom-role grants (CP2). Owner-only permissions are stripped here.
   * Never trust client-supplied arrays without server resolution.
   */
  extraPermissions?: readonly string[]
}

export type PermissionCheckOptions = {
  /** When set, must match actor.organizationId or access is denied. */
  resourceOrganizationId?: string | null
  /** When set for workspace-scoped checks, must match actor.workspaceId. */
  resourceWorkspaceId?: string | null
}

function sanitizeExtraPermissions(extras: readonly string[] | undefined): Permission[] {
  if (!extras?.length) return []
  const out: Permission[] = []
  for (const raw of extras) {
    if (!isPermission(raw)) continue
    if (isOwnerOnlyPermission(raw)) continue
    out.push(raw)
  }
  return out
}

/**
 * Resolve effective permissions from system roles + sanitized extras.
 * Platform admin does NOT receive organization permissions through this path.
 * Legacy User.role never contributes permissions.
 */
export function getEffectivePermissions(actor: PermissionActor): Set<Permission> {
  const set = new Set<Permission>()

  if (!actor.userId) return set
  if (!actor.organizationId || !actor.orgRole) {
    // No verified org membership → no org/workspace permissions
    return set
  }

  for (const p of permissionsForOrgRole(actor.orgRole)) {
    set.add(p)
  }

  if (actor.workspaceId && actor.workspaceRole) {
    for (const p of permissionsForWorkspaceRole(actor.workspaceRole)) {
      set.add(p)
    }
  }

  for (const p of sanitizeExtraPermissions(actor.extraPermissions)) {
    set.add(p)
  }

  // Defense in depth: only org owners may hold ownerOnly permissions
  if (actor.orgRole !== 'owner') {
    for (const p of [...set]) {
      if (isOwnerOnlyPermission(p)) set.delete(p)
    }
  }

  return set
}

export function hasPermission(
  actor: PermissionActor,
  permission: string,
  options?: PermissionCheckOptions
): boolean {
  if (!isPermission(permission)) return false
  if (!actor.userId) return false

  if (options?.resourceOrganizationId) {
    if (!actor.organizationId || actor.organizationId !== options.resourceOrganizationId) {
      return false
    }
  }

  if (options?.resourceWorkspaceId) {
    if (!actor.workspaceId || actor.workspaceId !== options.resourceWorkspaceId) {
      return false
    }
  }

  // Owner-only hard gate (billing.manage, etc.)
  if (isOwnerOnlyPermission(permission) && actor.orgRole !== 'owner') {
    return false
  }

  const effective = getEffectivePermissions(actor)
  return effective.has(permission)
}

export function assertPermission(
  actor: PermissionActor,
  permission: string,
  options?: PermissionCheckOptions
): void {
  assertValidPermission(permission)
  if (!hasPermission(actor, permission, options)) {
    throw new AppError('Forbidden', 403)
  }
}

/** Build a PermissionActor from a verified TenantContext-like object. */
export function permissionActorFromTenant(ctx: {
  userId: string
  platformRole?: string
  legacyRole?: string
  organizationId: string | null
  workspaceId?: string | null
  orgRole: OrgRole | null
  workspaceRole?: WorkspaceRole | null
  extraPermissions?: readonly string[]
}): PermissionActor {
  return {
    userId: ctx.userId,
    platformRole: ctx.platformRole,
    legacyRole: ctx.legacyRole,
    organizationId: ctx.organizationId,
    workspaceId: ctx.workspaceId ?? null,
    orgRole: ctx.orgRole,
    workspaceRole: ctx.workspaceRole ?? null,
    extraPermissions: ctx.extraPermissions,
  }
}

/**
 * Platform administration is separate from organization permissions.
 * This helper only checks the established platformRole field.
 */
export function hasPlatformAdminRole(actor: { platformRole?: string }): boolean {
  return actor.platformRole === 'platform_admin'
}

export function assertPlatformAdmin(actor: { platformRole?: string }): void {
  if (!hasPlatformAdminRole(actor)) {
    throw new AppError('Forbidden', 403)
  }
}
