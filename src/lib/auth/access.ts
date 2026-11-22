import { Types } from 'mongoose'
import { Project } from '@/lib/mongodb/models/Project'

export type SessionActor = {
  id: string
  role?: string
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

/** True when the actor owns the project, is listed in members, or is an admin. */
export function canAccessProject(
  project: { ownerId?: unknown; members?: unknown[] } | null | undefined,
  actor: SessionActor
): boolean {
  if (!project || !actor?.id) return false
  if (actor.role === 'admin') return true

  const ownerId = toIdString(project.ownerId)
  if (ownerId === actor.id) return true

  const members = Array.isArray(project.members) ? project.members : []
  return members.some((member) => toIdString(member) === actor.id)
}

/** Mongo filter for projects the actor may see. Admins see all. */
export function projectVisibilityFilter(actor: SessionActor): Record<string, unknown> {
  if (actor.role === 'admin') return {}
  return {
    $or: [{ ownerId: actor.id }, { members: actor.id }],
  }
}

export async function findAccessibleProject(projectId: string, actor: SessionActor) {
  if (!projectId || !Types.ObjectId.isValid(projectId)) return null
  const project = await Project.findById(projectId)
  if (!project) return null
  if (!canAccessProject(project, actor)) return null
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
