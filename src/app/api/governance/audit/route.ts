import { getActiveTenantContext } from '@/lib/tenancy/context'
import { tenantErrorResponse, jsonOk } from '@/lib/tenancy/http'
import { apiError } from '@/lib/api/response'
import { buildPermissionActor } from '@/lib/governance/roles/actor'
import { hasPermission } from '@/lib/governance/permissions'
import { listAuditEvents } from '@/lib/governance/audit/service'
import { Types } from 'mongoose'

export async function GET(req: Request) {
  try {
    const ctx = await getActiveTenantContext({ requireWorkspace: false })
    if (!ctx.organizationId) return apiError('Active organization required', 400)
    const actor = await buildPermissionActor(ctx)
    if (!hasPermission(actor, 'audit.read', { resourceOrganizationId: ctx.organizationId })) {
      return apiError('Forbidden', 403)
    }

    const url = new URL(req.url)
    const limit = Number(url.searchParams.get('limit') || 50)
    const action = url.searchParams.get('action') || undefined
    const resourceType = url.searchParams.get('resourceType') || undefined
    const outcome = url.searchParams.get('outcome') || undefined
    const actorUserId = url.searchParams.get('actorUserId') || undefined
    const workspaceId = url.searchParams.get('workspaceId') || undefined
    const beforeRaw = url.searchParams.get('before')
    const before = beforeRaw ? new Date(beforeRaw) : undefined

    if (actorUserId && !Types.ObjectId.isValid(actorUserId)) {
      return apiError('Invalid actorUserId', 400)
    }

    const events = await listAuditEvents({
      organizationId: ctx.organizationId,
      action,
      resourceType,
      outcome,
      actorUserId,
      workspaceId: workspaceId && Types.ObjectId.isValid(workspaceId) ? workspaceId : undefined,
      limit,
      before: before && !Number.isNaN(before.getTime()) ? before : undefined,
    })
    return jsonOk({ events })
  } catch (e) {
    return tenantErrorResponse(e)
  }
}
