import { z } from 'zod'
import { getActiveTenantContext } from '@/lib/tenancy/context'
import { tenantErrorResponse, jsonOk } from '@/lib/tenancy/http'
import { objectIdSchema, parseWithSchema } from '@/lib/api/validation'
import { apiError } from '@/lib/api/response'
import { buildPermissionActor } from '@/lib/governance/roles/actor'
import { assignRole, revokeRoleAssignment } from '@/lib/governance/roles/service'
import { connectDB } from '@/lib/mongodb/client'
import { RoleAssignment } from '@/lib/mongodb/models/RoleAssignment'
import { hasPermission } from '@/lib/governance/permissions'
import { checkRateLimit } from '@/lib/security/rateLimit'

const assignSchema = z
  .object({
    roleId: objectIdSchema,
    userId: objectIdSchema,
  })
  .strict()

const revokeSchema = z
  .object({
    assignmentId: objectIdSchema,
  })
  .strict()

export async function GET() {
  try {
    const ctx = await getActiveTenantContext({ requireWorkspace: false })
    if (!ctx.organizationId) return apiError('Active organization required', 400)
    const actor = await buildPermissionActor(ctx)
    if (!hasPermission(actor, 'members.read', { resourceOrganizationId: ctx.organizationId })) {
      return apiError('Forbidden', 403)
    }
    await connectDB()
    const assignments = await RoleAssignment.find({
      organizationId: ctx.organizationId,
      status: 'active',
    })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean()
    return jsonOk({ assignments })
  } catch (e) {
    return tenantErrorResponse(e)
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await getActiveTenantContext({ requireWorkspace: false })
    if (!ctx.organizationId) return apiError('Active organization required', 400)
    const rate = await checkRateLimit(`gov-role-assign:${ctx.userId}`, 30, 60_000)
    if (!rate.allowed) return apiError('Too many requests', 429)
    const body = await req.json()
    const parsed = parseWithSchema(assignSchema, body)
    if (parsed.ok === false) return parsed.response
    const actor = await buildPermissionActor(ctx)
    const assignment = await assignRole({
      organizationId: ctx.organizationId,
      roleId: parsed.data.roleId,
      userId: parsed.data.userId,
      actor,
    })
    return jsonOk({ assignment }, 201)
  } catch (e) {
    return tenantErrorResponse(e)
  }
}

export async function DELETE(req: Request) {
  try {
    const ctx = await getActiveTenantContext({ requireWorkspace: false })
    if (!ctx.organizationId) return apiError('Active organization required', 400)
    const body = await req.json()
    const parsed = parseWithSchema(revokeSchema, body)
    if (parsed.ok === false) return parsed.response
    const actor = await buildPermissionActor(ctx)
    const assignment = await revokeRoleAssignment({
      organizationId: ctx.organizationId,
      assignmentId: parsed.data.assignmentId,
      actor,
    })
    return jsonOk({ assignment })
  } catch (e) {
    return tenantErrorResponse(e)
  }
}
