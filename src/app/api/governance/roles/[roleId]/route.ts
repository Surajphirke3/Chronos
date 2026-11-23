import { z } from 'zod'
import { getActiveTenantContext } from '@/lib/tenancy/context'
import { tenantErrorResponse, jsonOk } from '@/lib/tenancy/http'
import { objectIdSchema, parseWithSchema } from '@/lib/api/validation'
import { apiError } from '@/lib/api/response'
import { buildPermissionActor } from '@/lib/governance/roles/actor'
import { updateOrganizationRole } from '@/lib/governance/roles/service'
import { connectDB } from '@/lib/mongodb/client'
import { OrganizationRole } from '@/lib/mongodb/models/OrganizationRole'
import { hasPermission } from '@/lib/governance/permissions'

const patchSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    description: z.string().max(500).optional(),
    permissions: z.array(z.string()).max(100).optional(),
    isActive: z.boolean().optional(),
  })
  .strict()

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ roleId: string }> }
) {
  try {
    const { roleId } = await params
    if (!objectIdSchema.safeParse(roleId).success) return apiError('Invalid id', 400)
    const ctx = await getActiveTenantContext({ requireWorkspace: false })
    if (!ctx.organizationId) return apiError('Active organization required', 400)
    const actor = await buildPermissionActor(ctx)
    if (!hasPermission(actor, 'members.read', { resourceOrganizationId: ctx.organizationId })) {
      return apiError('Forbidden', 403)
    }
    await connectDB()
    const role = await OrganizationRole.findOne({
      _id: roleId,
      organizationId: ctx.organizationId,
    }).lean()
    if (!role) return apiError('Not found', 404)
    return jsonOk({ role })
  } catch (e) {
    return tenantErrorResponse(e)
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ roleId: string }> }
) {
  try {
    const { roleId } = await params
    if (!objectIdSchema.safeParse(roleId).success) return apiError('Invalid id', 400)
    const ctx = await getActiveTenantContext({ requireWorkspace: false })
    if (!ctx.organizationId) return apiError('Active organization required', 400)
    const body = await req.json()
    const parsed = parseWithSchema(patchSchema, body)
    if (parsed.ok === false) return parsed.response
    const actor = await buildPermissionActor(ctx)
    const role = await updateOrganizationRole({
      organizationId: ctx.organizationId,
      roleId,
      actor,
      ...parsed.data,
    })
    return jsonOk({ role })
  } catch (e) {
    return tenantErrorResponse(e)
  }
}
