import { z } from 'zod'
import { getActiveTenantContext } from '@/lib/tenancy/context'
import { tenantErrorResponse, jsonOk } from '@/lib/tenancy/http'
import { parseWithSchema } from '@/lib/api/validation'
import { apiError } from '@/lib/api/response'
import { buildPermissionActor } from '@/lib/governance/roles/actor'
import { createApiKey, listApiKeys } from '@/lib/governance/apiKeys/service'
import { hasPermission } from '@/lib/governance/permissions'
import { checkRateLimit } from '@/lib/security/rateLimit'

const createSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    scopes: z.array(z.string()).min(1).max(50),
    expiresAt: z.string().datetime().optional().nullable(),
  })
  .strict()

export async function GET() {
  try {
    const ctx = await getActiveTenantContext({ requireWorkspace: false })
    if (!ctx.organizationId) return apiError('Active organization required', 400)
    const actor = await buildPermissionActor(ctx)
    if (!hasPermission(actor, 'api_keys.read', { resourceOrganizationId: ctx.organizationId })) {
      return apiError('Forbidden', 403)
    }
    const apiKeys = await listApiKeys(ctx.organizationId)
    return jsonOk({ apiKeys })
  } catch (e) {
    return tenantErrorResponse(e)
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await getActiveTenantContext({ requireWorkspace: false })
    if (!ctx.organizationId) return apiError('Active organization required', 400)
    const rate = await checkRateLimit(`api-keys:${ctx.userId}`, 10, 60_000)
    if (!rate.allowed) return apiError('Too many requests', 429)
    const body = await req.json()
    const parsed = parseWithSchema(createSchema, body)
    if (parsed.ok === false) return parsed.response
    const actor = await buildPermissionActor(ctx)
    const result = await createApiKey({
      organizationId: ctx.organizationId,
      actor,
      name: parsed.data.name,
      scopes: parsed.data.scopes,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
    })
    return jsonOk(result, 201)
  } catch (e) {
    return tenantErrorResponse(e)
  }
}
