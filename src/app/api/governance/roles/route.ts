import { z } from 'zod'
import { getActiveTenantContext } from '@/lib/tenancy/context'
import { tenantErrorResponse, jsonOk } from '@/lib/tenancy/http'
import { parseWithSchema } from '@/lib/api/validation'
import { apiError } from '@/lib/api/response'
import { buildPermissionActor } from '@/lib/governance/roles/actor'
import {
  createOrganizationRole,
  listOrganizationRoles,
} from '@/lib/governance/roles/service'
import { hasPermission } from '@/lib/governance/permissions'
import { checkRateLimit } from '@/lib/security/rateLimit'

const createSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    description: z.string().max(500).optional(),
    permissions: z.array(z.string()).max(100),
    slug: z.string().trim().min(1).max(80).optional(),
  })
  .strict()

export async function GET() {
  try {
    const ctx = await getActiveTenantContext({ requireWorkspace: false })
    if (!ctx.organizationId) return apiError('Active organization required', 400)
    const actor = await buildPermissionActor(ctx)
    if (!hasPermission(actor, 'members.roles.manage', {
      resourceOrganizationId: ctx.organizationId,
    }) && !hasPermission(actor, 'members.read', { resourceOrganizationId: ctx.organizationId })) {
      return apiError('Forbidden', 403)
    }
    const roles = await listOrganizationRoles(ctx.organizationId)
    return jsonOk({ roles })
  } catch (e) {
    return tenantErrorResponse(e)
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await getActiveTenantContext({ requireWorkspace: false })
    if (!ctx.organizationId) return apiError('Active organization required', 400)
    const rate = await checkRateLimit(`gov-roles:${ctx.userId}`, 30, 60_000)
    if (!rate.allowed) return apiError('Too many requests', 429)

    const body = await req.json()
    const parsed = parseWithSchema(createSchema, body)
    if (parsed.ok === false) return parsed.response

    const actor = await buildPermissionActor(ctx)
    const role = await createOrganizationRole({
      organizationId: ctx.organizationId,
      actor,
      name: parsed.data.name,
      description: parsed.data.description,
      permissions: parsed.data.permissions,
      slug: parsed.data.slug,
    })
    return jsonOk({ role }, 201)
  } catch (e) {
    return tenantErrorResponse(e)
  }
}
