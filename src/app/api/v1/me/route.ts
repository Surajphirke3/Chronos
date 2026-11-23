import { jsonOk } from '@/lib/tenancy/http'
import { apiError } from '@/lib/api/response'
import { authenticateBearerApiKey } from '@/lib/governance/apiKeys/service'

/** Minimal public API probe — API key auth only. */
export async function GET(req: Request) {
  const auth = await authenticateBearerApiKey(req.headers.get('authorization'))
  if (!auth) return apiError('Unauthorized', 401)
  return jsonOk({
    authenticated: true,
    organizationId: auth.organizationId,
    workspaceId: auth.workspaceId,
    apiKeyId: auth.apiKeyId,
    scopes: auth.scopes,
  })
}
