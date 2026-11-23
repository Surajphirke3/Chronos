import { z } from 'zod'
import { getActiveTenantContext } from '@/lib/tenancy/context'
import { tenantErrorResponse, jsonOk } from '@/lib/tenancy/http'
import { parseWithSchema } from '@/lib/api/validation'
import { apiError } from '@/lib/api/response'
import { buildPermissionActor } from '@/lib/governance/roles/actor'
import { hasPermission } from '@/lib/governance/permissions'
import {
  getOrCreateSecurityPolicy,
  updateSecurityPolicy,
} from '@/lib/governance/security/policy'

const patchSchema = z
  .object({
    allowedInviteEmailDomains: z.array(z.string().max(120)).max(50).optional(),
    allowGuestAccess: z.boolean().optional(),
    whoCanInvite: z.enum(['owner', 'admin', 'members_with_permission']).optional(),
    allowApiKeyCreation: z.boolean().optional(),
    maxApiKeyLifetimeDays: z.number().int().min(1).max(730).optional(),
    allowDataExport: z.boolean().optional(),
    restrictWorkspaceCreationToAdmins: z.boolean().optional(),
  })
  .strict()

export async function GET() {
  try {
    const ctx = await getActiveTenantContext({ requireWorkspace: false })
    if (!ctx.organizationId) return apiError('Active organization required', 400)
    const actor = await buildPermissionActor(ctx)
    if (!hasPermission(actor, 'security.read', { resourceOrganizationId: ctx.organizationId })) {
      return apiError('Forbidden', 403)
    }
    const policy = await getOrCreateSecurityPolicy(ctx.organizationId)
    return jsonOk({ policy })
  } catch (e) {
    return tenantErrorResponse(e)
  }
}

export async function PATCH(req: Request) {
  try {
    const ctx = await getActiveTenantContext({ requireWorkspace: false })
    if (!ctx.organizationId) return apiError('Active organization required', 400)
    const body = await req.json()
    const parsed = parseWithSchema(patchSchema, body)
    if (parsed.ok === false) return parsed.response
    const actor = await buildPermissionActor(ctx)
    const policy = await updateSecurityPolicy({
      organizationId: ctx.organizationId,
      actor,
      patch: parsed.data,
    })
    return jsonOk({ policy })
  } catch (e) {
    return tenantErrorResponse(e)
  }
}
