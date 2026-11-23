import { getServerSession } from 'next-auth'
import { Types } from 'mongoose'
import { authOptions } from '@/lib/auth/options'
import { connectDB } from '@/lib/mongodb/client'
import { User } from '@/lib/mongodb/models/User'
import { Organization } from '@/lib/mongodb/models/Organization'
import { Workspace } from '@/lib/mongodb/models/Workspace'
import { Membership } from '@/lib/mongodb/models/Membership'
import { WorkspaceMembership } from '@/lib/mongodb/models/WorkspaceMembership'
import {
  DEFAULT_ORG_MIGRATION_KEY,
  DEFAULT_WORKSPACE_MIGRATION_KEY,
  isMultiTenantEnforced,
} from '@/lib/tenancy/flags'
import { orgRoleAtLeast, workspaceRoleAtLeast, type OrgRole, type WorkspaceRole } from '@/lib/tenancy/roles'
import { AppError } from '@/lib/api/errors'

export type TenantContext = {
  userId: string
  email: string
  /** Legacy User.role — not an org/workspace role */
  legacyRole: string
  platformRole: string
  organizationId: string | null
  workspaceId: string | null
  orgRole: OrgRole | null
  workspaceRole: WorkspaceRole | null
  /**
   * True only for the deployment default migrated tenant.
   * Dual-read of unscoped legacy rows is allowed solely in this context.
   */
  allowsLegacyUnscopedRead: boolean
  organization: {
    _id: string
    name: string
    slug: string
    status: string
    migrationKey?: string | null
  } | null
  workspace: {
    _id: string
    name: string
    slug: string
    status: string
    organizationId: string
    isDefault?: boolean
    migrationKey?: string | null
  } | null
}

export async function requireAuthenticatedUser(): Promise<{
  userId: string
  email: string
  legacyRole: string
  platformRole: string
}> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    throw new AppError('Unauthorized', 401)
  }
  await connectDB()
  const user = await User.findById(session.user.id).select('email role platformRole isActive').lean()
  if (!user || user.isActive === false) {
    throw new AppError('Unauthorized', 401)
  }
  return {
    userId: session.user.id,
    email: String(user.email || session.user.email || ''),
    legacyRole: String(user.role || 'member'),
    platformRole: String(user.platformRole || 'none'),
  }
}

async function loadMemberships(userId: string, organizationId: string, workspaceId?: string | null) {
  const orgMembership = await Membership.findOne({
    organizationId,
    userId,
    status: 'active',
  }).lean()

  let workspaceMembership = null
  if (workspaceId) {
    workspaceMembership = await WorkspaceMembership.findOne({
      workspaceId,
      userId,
      status: 'active',
    }).lean()
  }

  return { orgMembership, workspaceMembership }
}

/**
 * Resolve verified active org/workspace for the current user.
 * Never trusts client-provided IDs alone — membership is re-checked.
 */
export async function getActiveTenantContext(options?: {
  organizationId?: string | null
  workspaceId?: string | null
  requireWorkspace?: boolean
}): Promise<TenantContext> {
  const auth = await requireAuthenticatedUser()
  await connectDB()

  const user = await User.findById(auth.userId)
    .select('activeOrganizationId activeWorkspaceId platformRole role email')
    .lean()

  let organizationId =
    options?.organizationId ||
    (user?.activeOrganizationId ? String(user.activeOrganizationId) : null)
  let workspaceId =
    options?.workspaceId || (user?.activeWorkspaceId ? String(user.activeWorkspaceId) : null)

  // Prefer JWT claims if present and consistent (refreshed via session)
  // Membership DB check is authoritative below.

  let organization = null
  let workspace = null
  let orgRole: OrgRole | null = null
  let workspaceRole: WorkspaceRole | null = null

  if (organizationId && Types.ObjectId.isValid(organizationId)) {
    organization = await Organization.findOne({
      _id: organizationId,
      status: 'active',
    })
      .select('name slug status migrationKey')
      .lean()

    if (organization) {
      const { orgMembership, workspaceMembership } = await loadMemberships(
        auth.userId,
        organizationId,
        workspaceId
      )
      if (!orgMembership) {
        organization = null
        organizationId = null
        workspaceId = null
      } else {
        orgRole = orgMembership.role as OrgRole
        if (workspaceId && Types.ObjectId.isValid(workspaceId)) {
          workspace = await Workspace.findOne({
            _id: workspaceId,
            organizationId,
            status: 'active',
          })
            .select('name slug status organizationId isDefault migrationKey')
            .lean()
          if (!workspace || !workspaceMembership) {
            workspace = null
            workspaceId = null
            workspaceRole = null
          } else {
            workspaceRole = workspaceMembership.role as WorkspaceRole
          }
        }
      }
    } else {
      organizationId = null
      workspaceId = null
    }
  }

  if (options?.requireWorkspace || isMultiTenantEnforced()) {
    if (!organizationId || !workspaceId || !orgRole || !workspaceRole) {
      throw new AppError('Active workspace required', 403)
    }
  }

  const allowsLegacyUnscopedRead = Boolean(
    organization?.migrationKey === DEFAULT_ORG_MIGRATION_KEY &&
      workspace &&
      (workspace.migrationKey === DEFAULT_WORKSPACE_MIGRATION_KEY || workspace.isDefault === true)
  )

  return {
    userId: auth.userId,
    email: auth.email,
    legacyRole: auth.legacyRole,
    platformRole: auth.platformRole,
    organizationId,
    workspaceId,
    orgRole,
    workspaceRole,
    allowsLegacyUnscopedRead,
    organization: organization
      ? {
          _id: String(organization._id),
          name: organization.name,
          slug: organization.slug,
          status: organization.status,
          migrationKey: organization.migrationKey || null,
        }
      : null,
    workspace: workspace
      ? {
          _id: String(workspace._id),
          name: workspace.name,
          slug: workspace.slug,
          status: workspace.status,
          organizationId: String(workspace.organizationId),
          isDefault: Boolean(workspace.isDefault),
          migrationKey: workspace.migrationKey || null,
        }
      : null,
  }
}

export async function requireOrganizationAccess(
  organizationId: string,
  minimumRole: OrgRole = 'member'
): Promise<TenantContext & { organizationId: string; orgRole: OrgRole }> {
  const ctx = await getActiveTenantContext({ organizationId, requireWorkspace: false })
  if (!ctx.organizationId || ctx.organizationId !== organizationId || !ctx.orgRole) {
    throw new AppError('Forbidden', 403)
  }
  if (!orgRoleAtLeast(ctx.orgRole, minimumRole)) {
    throw new AppError('Forbidden', 403)
  }
  return ctx as TenantContext & { organizationId: string; orgRole: OrgRole }
}

export async function requireWorkspaceAccess(
  workspaceId: string,
  minimumRole: WorkspaceRole = 'member'
): Promise<
  TenantContext & {
    organizationId: string
    workspaceId: string
    orgRole: OrgRole
    workspaceRole: WorkspaceRole
  }
> {
  if (!Types.ObjectId.isValid(workspaceId)) {
    throw new AppError('Invalid workspace', 400)
  }
  await connectDB()
  const workspace = await Workspace.findOne({ _id: workspaceId, status: 'active' })
    .select('organizationId')
    .lean()
  if (!workspace) {
    throw new AppError('Not found', 404)
  }

  const ctx = await getActiveTenantContext({
    organizationId: String(workspace.organizationId),
    workspaceId,
    requireWorkspace: true,
  })

  if (
    !ctx.workspaceId ||
    ctx.workspaceId !== workspaceId ||
    !ctx.organizationId ||
    !ctx.workspaceRole ||
    !ctx.orgRole
  ) {
    throw new AppError('Forbidden', 403)
  }
  if (!workspaceRoleAtLeast(ctx.workspaceRole, minimumRole)) {
    throw new AppError('Forbidden', 403)
  }

  return ctx as TenantContext & {
    organizationId: string
    workspaceId: string
    orgRole: OrgRole
    workspaceRole: WorkspaceRole
  }
}

/**
 * Workspace filter for list queries.
 * Dual-read of unscoped legacy rows is restricted to the default migrated tenant only.
 * Other workspaces/orgs never see null-workspaceId records (prevents cross-tenant leaks).
 */
export function workspaceScopedFilter(
  ctx: TenantContext,
  extra: Record<string, unknown> = {}
): Record<string, unknown> {
  if (ctx.workspaceId) {
    if (isMultiTenantEnforced() || !ctx.allowsLegacyUnscopedRead) {
      return { ...extra, workspaceId: ctx.workspaceId }
    }
    return {
      ...extra,
      $or: [{ workspaceId: ctx.workspaceId }, { workspaceId: { $exists: false } }, { workspaceId: null }],
    }
  }
  if (isMultiTenantEnforced()) {
    return { ...extra, workspaceId: '__none__' }
  }
  return { ...extra }
}

export function isPlatformAdmin(ctx: { platformRole?: string }): boolean {
  return ctx.platformRole === 'platform_admin'
}

export function accessOptionsFromTenant(ctx: TenantContext) {
  return {
    workspaceId: ctx.workspaceId,
    workspaceRole: ctx.workspaceRole,
    // Never treat dual-read as "all unscoped rows for every workspace"
    dualReadLegacy: Boolean(ctx.allowsLegacyUnscopedRead) && !isMultiTenantEnforced(),
  }
}
