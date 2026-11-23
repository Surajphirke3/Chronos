import { getActiveTenantContext } from '@/lib/tenancy/context'
import { tenantErrorResponse, jsonOk } from '@/lib/tenancy/http'
import { objectIdSchema } from '@/lib/api/validation'
import { apiError } from '@/lib/api/response'
import { buildPermissionActor } from '@/lib/governance/roles/actor'
import { revokeApiKey } from '@/lib/governance/apiKeys/service'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!objectIdSchema.safeParse(id).success) return apiError('Invalid id', 400)
    const ctx = await getActiveTenantContext({ requireWorkspace: false })
    if (!ctx.organizationId) return apiError('Active organization required', 400)
    const actor = await buildPermissionActor(ctx)
    const apiKey = await revokeApiKey({
      organizationId: ctx.organizationId,
      apiKeyId: id,
      actor,
    })
    return jsonOk({ apiKey })
  } catch (e) {
    return tenantErrorResponse(e)
  }
}
