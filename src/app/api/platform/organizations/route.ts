import { requireAuthenticatedUser, isPlatformAdmin } from '@/lib/tenancy/context'
import { tenantErrorResponse, jsonOk } from '@/lib/tenancy/http'
import { apiError } from '@/lib/api/response'
import { connectDB } from '@/lib/mongodb/client'
import { Organization } from '@/lib/mongodb/models/Organization'
import { writeBestEffortAudit } from '@/lib/governance/audit/service'

export async function GET() {
  try {
    const auth = await requireAuthenticatedUser()
    if (!isPlatformAdmin(auth)) return apiError('Forbidden', 403)
    await connectDB()
    const organizations = await Organization.find({})
      .select('name slug status createdAt migrationKey')
      .sort({ createdAt: -1 })
      .limit(200)
      .lean()

    // Platform list is audited as a sensitive investigation action.
    if (organizations[0]) {
      await writeBestEffortAudit({
        organizationId: String(organizations[0]._id),
        actorUserId: auth.userId,
        actorType: 'platform',
        action: 'platform.organizations.listed',
        resourceType: 'Organization',
        source: 'platform',
        metadata: { count: organizations.length },
      })
    }

    return jsonOk({ organizations })
  } catch (e) {
    return tenantErrorResponse(e)
  }
}
