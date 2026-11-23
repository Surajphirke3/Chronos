import { Types } from 'mongoose'
import { connectDB } from '@/lib/mongodb/client'
import { OrganizationRole } from '@/lib/mongodb/models/OrganizationRole'
import { RoleAssignment } from '@/lib/mongodb/models/RoleAssignment'
import { Membership } from '@/lib/mongodb/models/Membership'
import { AppError } from '@/lib/api/errors'
import {
  isOwnerOnlyPermission,
  isPermission,
  type Permission,
} from '@/lib/governance/permissions/catalog'
import { hasPermission, type PermissionActor } from '@/lib/governance/permissions/evaluate'
import { isGovernanceCustomRolesEnabled } from '@/lib/governance/flags'
import { slugify } from '@/lib/tenancy/slug'

export function sanitizeDelegablePermissions(
  requested: string[],
  actor: PermissionActor
): Permission[] {
  // Owner-only never delegable; actor must already hold each permission via system role.
  const out: Permission[] = []
  for (const raw of requested) {
    if (!isPermission(raw)) {
      throw new AppError(`Invalid permission: ${raw}`, 400)
    }
    if (isOwnerOnlyPermission(raw)) {
      throw new AppError(`Permission cannot be delegated: ${raw}`, 403)
    }
    if (!hasPermission(actor, raw)) {
      throw new AppError(`Cannot delegate permission you do not hold: ${raw}`, 403)
    }
    out.push(raw)
  }
  return [...new Set(out)]
}

export async function listOrganizationRoles(organizationId: string) {
  await connectDB()
  return OrganizationRole.find({ organizationId, isActive: true })
    .sort({ name: 1 })
    .lean()
}

export async function createOrganizationRole(params: {
  organizationId: string
  actor: PermissionActor
  name: string
  description?: string
  permissions: string[]
  slug?: string
}) {
  if (!isGovernanceCustomRolesEnabled()) {
    throw new AppError('Custom roles are disabled', 403)
  }
  if (!hasPermission(params.actor, 'members.roles.manage', {
    resourceOrganizationId: params.organizationId,
  })) {
    throw new AppError('Forbidden', 403)
  }

  const permissions = sanitizeDelegablePermissions(params.permissions, params.actor)
  const slug = (params.slug || slugify(params.name)).slice(0, 80)
  if (!slug) throw new AppError('Invalid role slug', 400)

  await connectDB()
  try {
    const role = await OrganizationRole.create({
      organizationId: params.organizationId,
      name: params.name.trim(),
      slug,
      description: params.description || '',
      permissions,
      isSystem: false,
      isActive: true,
      version: 1,
      createdBy: params.actor.userId,
      updatedBy: params.actor.userId,
    })
    return role.toObject()
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'code' in e && (e as { code: number }).code === 11000) {
      throw new AppError('Role slug already exists in this organization', 409)
    }
    throw e
  }
}

export async function updateOrganizationRole(params: {
  organizationId: string
  roleId: string
  actor: PermissionActor
  name?: string
  description?: string
  permissions?: string[]
  isActive?: boolean
}) {
  if (!isGovernanceCustomRolesEnabled()) {
    throw new AppError('Custom roles are disabled', 403)
  }
  if (!hasPermission(params.actor, 'members.roles.manage', {
    resourceOrganizationId: params.organizationId,
  })) {
    throw new AppError('Forbidden', 403)
  }

  await connectDB()
  const role = await OrganizationRole.findOne({
    _id: params.roleId,
    organizationId: params.organizationId,
  })
  if (!role) throw new AppError('Not found', 404)
  if (role.isSystem) throw new AppError('System roles cannot be modified', 403)

  if (params.permissions) {
    role.permissions = sanitizeDelegablePermissions(params.permissions, params.actor)
  }
  if (params.name !== undefined) role.name = params.name.trim()
  if (params.description !== undefined) role.description = params.description
  if (params.isActive === false) {
    role.isActive = false
  }
  role.version = (role.version || 1) + 1
  role.updatedBy = params.actor.userId
  await role.save()
  return role.toObject()
}

export async function assignRole(params: {
  organizationId: string
  roleId: string
  userId: string
  actor: PermissionActor
}) {
  if (!isGovernanceCustomRolesEnabled()) {
    throw new AppError('Custom roles are disabled', 403)
  }
  if (!hasPermission(params.actor, 'members.roles.manage', {
    resourceOrganizationId: params.organizationId,
  })) {
    throw new AppError('Forbidden', 403)
  }

  await connectDB()
  const role = await OrganizationRole.findOne({
    _id: params.roleId,
    organizationId: params.organizationId,
    isActive: true,
  }).lean()
  if (!role) throw new AppError('Not found', 404)
  if (role.isSystem) throw new AppError('Cannot assign system role records', 403)

  // Target must be an active org member
  const membership = await Membership.findOne({
    organizationId: params.organizationId,
    userId: params.userId,
    status: 'active',
  }).lean()
  if (!membership) throw new AppError('Target user is not an organization member', 400)

  // Ensure actor could still hold every permission on the role (defense in depth)
  sanitizeDelegablePermissions(role.permissions || [], params.actor)

  const existing = await RoleAssignment.findOne({
    organizationId: params.organizationId,
    userId: params.userId,
    roleId: params.roleId,
  })
  if (existing) {
    if (existing.status === 'active') return existing.toObject()
    existing.status = 'active'
    existing.revokedAt = null
    existing.revokedBy = null
    existing.assignedBy = params.actor.userId
    await existing.save()
    return existing.toObject()
  }

  const assignment = await RoleAssignment.create({
    organizationId: params.organizationId,
    userId: params.userId,
    roleId: params.roleId,
    assignedBy: params.actor.userId,
    status: 'active',
  })
  return assignment.toObject()
}

export async function revokeRoleAssignment(params: {
  organizationId: string
  assignmentId: string
  actor: PermissionActor
}) {
  if (!isGovernanceCustomRolesEnabled()) {
    throw new AppError('Custom roles are disabled', 403)
  }
  if (!hasPermission(params.actor, 'members.roles.manage', {
    resourceOrganizationId: params.organizationId,
  })) {
    throw new AppError('Forbidden', 403)
  }

  await connectDB()
  const assignment = await RoleAssignment.findOne({
    _id: params.assignmentId,
    organizationId: params.organizationId,
  })
  if (!assignment) throw new AppError('Not found', 404)
  if (assignment.status === 'revoked') return assignment.toObject()

  assignment.status = 'revoked'
  assignment.revokedAt = new Date()
  assignment.revokedBy = params.actor.userId
  await assignment.save()
  return assignment.toObject()
}

/** Load active custom-role permissions for a user within an organization. */
export async function resolveCustomRolePermissions(
  organizationId: string,
  userId: string
): Promise<Permission[]> {
  if (!isGovernanceCustomRolesEnabled()) return []
  if (!Types.ObjectId.isValid(organizationId) || !Types.ObjectId.isValid(userId)) return []

  await connectDB()
  const assignments = await RoleAssignment.find({
    organizationId,
    userId,
    status: 'active',
  })
    .select('roleId')
    .lean()
  if (!assignments.length) return []

  const roleIds = assignments.map((a: { roleId: unknown }) => a.roleId)
  const roles = await OrganizationRole.find({
    _id: { $in: roleIds },
    organizationId,
    isActive: true,
  })
    .select('permissions')
    .lean()

  const set = new Set<Permission>()
  for (const role of roles) {
    for (const p of role.permissions || []) {
      if (isPermission(p) && !isOwnerOnlyPermission(p)) set.add(p)
    }
  }
  return [...set]
}
