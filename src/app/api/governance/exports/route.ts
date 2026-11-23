import { z } from 'zod'
import { getActiveTenantContext } from '@/lib/tenancy/context'
import { tenantErrorResponse, jsonOk } from '@/lib/tenancy/http'
import { parseWithSchema } from '@/lib/api/validation'
import { apiError } from '@/lib/api/response'
import { buildPermissionActor } from '@/lib/governance/roles/actor'
import { requestDataExport } from '@/lib/governance/data/exportService'
import { connectDB } from '@/lib/mongodb/client'
import { DataExportRequest } from '@/lib/mongodb/models/DataExportRequest'
import { hasPermission } from '@/lib/governance/permissions'
import { checkRateLimit } from '@/lib/security/rateLimit'

const createSchema = z
  .object({
    scope: z.enum(['organization', 'workspace']).default('organization'),
  })
  .strict()

export async function GET() {
  try {
    const ctx = await getActiveTenantContext({ requireWorkspace: false })
    if (!ctx.organizationId) return apiError('Active organization required', 400)
    const actor = await buildPermissionActor(ctx)
    if (!hasPermission(actor, 'data.export', { resourceOrganizationId: ctx.organizationId })) {
      return apiError('Forbidden', 403)
    }
    await connectDB()
    const exports = await DataExportRequest.find({ organizationId: ctx.organizationId })
      .select('-downloadTokenHash -artifactPath')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean()
    return jsonOk({ exports })
  } catch (e) {
    return tenantErrorResponse(e)
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await getActiveTenantContext({ requireWorkspace: false })
    if (!ctx.organizationId) return apiError('Active organization required', 400)
    const rate = await checkRateLimit(`data-export:${ctx.userId}`, 5, 60_000)
    if (!rate.allowed) return apiError('Too many requests', 429)
    const body = await req.json().catch(() => ({}))
    const parsed = parseWithSchema(createSchema, body)
    if (parsed.ok === false) return parsed.response
    const actor = await buildPermissionActor(ctx)
    const exportReq = await requestDataExport({
      organizationId: ctx.organizationId,
      workspaceId: ctx.workspaceId,
      actor,
      scope: parsed.data.scope,
    })
    return jsonOk({ export: exportReq }, 201)
  } catch (e) {
    return tenantErrorResponse(e)
  }
}
