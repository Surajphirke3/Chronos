import { getActiveTenantContext } from '@/lib/tenancy/context'
import { tenantErrorResponse, jsonOk } from '@/lib/tenancy/http'
import { apiError } from '@/lib/api/response'
import { INTEGRATION_PROVIDERS, isIntegrationsEnabled } from '@/lib/integrations/registry'

export async function GET() {
  try {
    await getActiveTenantContext({ requireWorkspace: false })
    if (!isIntegrationsEnabled()) {
      return apiError('Integrations are disabled', 403)
    }
    return jsonOk({
      providers: INTEGRATION_PROVIDERS.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        authType: p.authType,
        liveAvailable: p.liveAvailable,
        scopes: p.scopes || [],
      })),
    })
  } catch (e) {
    return tenantErrorResponse(e)
  }
}
