import { AppError, toSafeClientMessage } from '@/lib/api/errors'
import { apiError } from '@/lib/api/response'
import { NextResponse } from 'next/server'

export function tenantErrorResponse(error: unknown, fallback = 'Internal server error') {
  if (error instanceof AppError) {
    return apiError(error.message, error.status)
  }
  console.error(toSafeClientMessage(error, fallback))
  return apiError(fallback, 500)
}

/** Merge Mongo filters with $and when both sides are non-empty. */
export function mergeMongoFilters(
  ...filters: Array<Record<string, unknown> | null | undefined>
): Record<string, unknown> {
  const parts = filters.filter((f): f is Record<string, unknown> => Boolean(f && Object.keys(f).length > 0))
  if (parts.length === 0) return {}
  if (parts.length === 1) return parts[0]
  return { $and: parts }
}

export function assertResourceInWorkspace(
  resource: { workspaceId?: unknown } | null | undefined,
  workspaceId: string | null,
  dualReadLegacy = false
): boolean {
  if (!resource) return false
  if (!workspaceId) return !process.env.MULTI_TENANT_ENFORCE || process.env.MULTI_TENANT_ENFORCE !== 'true'
  const rid = resource.workspaceId ? String(resource.workspaceId) : null
  if (rid === workspaceId) return true
  if (dualReadLegacy && !rid) return true
  return false
}

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status })
}
