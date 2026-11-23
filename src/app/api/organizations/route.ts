import { z } from 'zod'
import { connectDB } from '@/lib/mongodb/client'
import { Organization } from '@/lib/mongodb/models/Organization'
import { Membership } from '@/lib/mongodb/models/Membership'
import { requireAuthenticatedUser } from '@/lib/tenancy/context'
import { createOrganizationWithDefaultWorkspace } from '@/lib/tenancy/bootstrap'
import { parseWithSchema } from '@/lib/api/validation'
import { apiOk, apiUnauthorized } from '@/lib/api/response'
import { tenantErrorResponse } from '@/lib/tenancy/http'

const createSchema = z.object({
  name: z.string().trim().min(2).max(100),
  slug: z.string().trim().min(2).max(64).optional(),
  description: z.string().trim().max(500).optional(),
})

export async function GET() {
  try {
    const auth = await requireAuthenticatedUser()
    await connectDB()

    const memberships = await Membership.find({
      userId: auth.userId,
      status: 'active',
    }).lean()

    const orgIds = memberships.map((m: { organizationId: unknown }) => m.organizationId)
    const organizations = await Organization.find({
      _id: { $in: orgIds },
      status: 'active',
    })
      .select('name slug description logoUrl status createdAt')
      .sort({ name: 1 })
      .lean()

    const roleByOrg = new Map(
      memberships.map((m: { organizationId: { toString: () => string }; role: string }) => [
        String(m.organizationId),
        m.role,
      ])
    )

    return apiOk({
      organizations: organizations.map((org: { _id: { toString: () => string } }) => ({
        ...org,
        role: roleByOrg.get(String(org._id)) || 'member',
      })),
    })
  } catch (error) {
    if ((error as { status?: number })?.status === 401) return apiUnauthorized()
    return tenantErrorResponse(error, 'Failed to list organizations')
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireAuthenticatedUser()
    const body = await req.json()
    const parsed = parseWithSchema(createSchema, body)
    if (parsed.ok === false) return parsed.response

    const result = await createOrganizationWithDefaultWorkspace({
      name: parsed.data.name,
      slug: parsed.data.slug,
      description: parsed.data.description,
      userId: auth.userId,
    })

    return apiOk(result, { status: 201 })
  } catch (error) {
    if ((error as { status?: number })?.status === 401) return apiUnauthorized()
    return tenantErrorResponse(error, 'Failed to create organization')
  }
}
