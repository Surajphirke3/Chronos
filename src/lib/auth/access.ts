import { Types } from 'mongoose'
import { Project } from '@/lib/mongodb/models/Project'
import { isMultiTenantEnforced } from '@/lib/tenancy/flags'
import { workspaceRoleAtLeast, type WorkspaceRole } from '@/lib/tenancy/roles'
import { mergeMongoFilters } from '@/lib/tenancy/http'

export type SessionActor = {
  id: string
  role?: string
}

export type ProjectAccessOptions = {
  workspaceId?: string | null
  workspaceRole?: WorkspaceRole | null
  /** When true (default under dual-read), allow legacy rows missing workspaceId */
  dualReadLegacy?: boolean
}

function toIdString(value: unknown): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (value instanceof Types.ObjectId) return value.toString()
  if (typeof value === 'object' && value !== null && '_id' in value) {
    return toIdString((value as { _id: unknown })._id)
  }
  return String(value)
}

function isProjectMember(
  project: { ownerId?: unknown; members?: unknown[] },
  actorId: string
): boolean {
  const ownerId = toIdString(project.ownerId)
  if (ownerId === actorId) return true
  const members = Array.isArray(project.members) ? project.members : []
  return members.some((member) => toIdString(member) === actorId)
}

function workspaceMatches(
  project: { workspaceId?: unknown },
  options?: ProjectAccessOptions
): boolean {
  if (!options?.workspaceId) {
    // Without an active workspace, only allow under legacy (non-enforced) mode
    return !isMultiTenantEnforced()
  }
  const rid = project.workspaceId ? String(project.workspaceId) : null
  if (rid === options.workspaceId) return true
  const dual = options.dualReadLegacy ?? !isMultiTenantEnforced()
  return dual && !rid
}

/**
 * Project access:
 * - Workspace admin/owner: all projects in the verified workspace
 * - Workspace member/guest: project owner/member ACL
 * - Legacy (no workspace, enforce off): owner/member, or legacy User.role=admin
 */
export function canAccessProject(
  project: { ownerId?: unknown; members?: unknown[]; workspaceId?: unknown } | null | undefined,
  actor: SessionActor,
  options?: ProjectAccessOptions
): boolean {
  if (!project || !actor?.id) return false
  if (!workspaceMatches(project, options)) return false

  if (options?.workspaceRole && workspaceRoleAtLeast(options.workspaceRole, 'admin')) {
    return true
  }

  if (isProjectMember(project, actor.id)) return true

  // Legacy global admin bypass only when tenancy is not enforced and no workspace context
  if (!isMultiTenantEnforced() && !options?.workspaceId && actor.role === 'admin') {
    return true
  }

  return false
}

/** Mongo filter for projects the actor may see within optional workspace scope. */
export function projectVisibilityFilter(
  actor: SessionActor,
  options?: ProjectAccessOptions
): Record<string, unknown> {
  const dual = options?.dualReadLegacy ?? !isMultiTenantEnforced()

  let workspaceFilter: Record<string, unknown> = {}
  if (options?.workspaceId) {
    if (isMultiTenantEnforced() || !dual) {
      workspaceFilter = { workspaceId: options.workspaceId }
    } else {
      workspaceFilter = {
        $or: [
          { workspaceId: options.workspaceId },
          { workspaceId: { $exists: false } },
          { workspaceId: null },
        ],
      }
    }
  } else if (isMultiTenantEnforced()) {
    workspaceFilter = { workspaceId: '__none__' }
  }

  let visibility: Record<string, unknown> = {}
  if (options?.workspaceRole && workspaceRoleAtLeast(options.workspaceRole, 'admin')) {
    visibility = {}
  } else if (!isMultiTenantEnforced() && !options?.workspaceId && actor.role === 'admin') {
    visibility = {}
  } else {
    visibility = {
      $or: [{ ownerId: actor.id }, { members: actor.id }],
    }
  }

  return mergeMongoFilters(workspaceFilter, visibility)
}

export async function findAccessibleProject(
  projectId: string,
  actor: SessionActor,
  options?: ProjectAccessOptions
) {
  if (!projectId || !Types.ObjectId.isValid(projectId)) return null
  const project = await Project.findById(projectId)
  if (!project) return null
  if (!canAccessProject(project, actor, options)) return null
  return project
}

/** Whitelisted fields for project updates — blocks ownerId takeover via mass assignment. */
export const PROJECT_PATCH_FIELDS = [
  'name',
  'description',
  'status',
  'color',
  'members',
  'dueDate',
] as const

export const TASK_PATCH_FIELDS = [
  'title',
  'description',
  'status',
  'priority',
  'assigneeId',
  'dueDate',
  'position',
  'tags',
  'projectId',
] as const

export const DOC_PATCH_FIELDS = [
  'title',
  'content',
  'type',
  'projectId',
  'isPinned',
] as const

export const WORKFLOW_PATCH_FIELDS = [
  'name',
  'description',
  'nodes',
  'edges',
  'status',
  'config',
] as const

export function pickAllowedFields<T extends string>(
  body: Record<string, unknown>,
  allowed: readonly T[]
): Partial<Record<T, unknown>> {
  const result: Partial<Record<T, unknown>> = {}
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(body, key) && body[key] !== undefined) {
      result[key] = body[key]
    }
  }
  return result
}

/** Redact secret values for API responses while indicating whether a value is stored. */
export function maskSecret(value: string | undefined | null): {
  value: string
  isSet: boolean
} {
  const isSet = Boolean(value && value.length > 0)
  return { value: '', isSet }
}

/** Skip overwriting a stored secret when the client sends a blank or placeholder value. */
export function shouldUpdateSecret(incoming: unknown): boolean {
  if (typeof incoming !== 'string') return false
  const trimmed = incoming.trim()
  if (!trimmed) return false
  if (/^•+$/.test(trimmed) || trimmed === '[REDACTED]') return false
  return true
}
