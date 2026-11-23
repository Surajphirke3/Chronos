import { Types } from 'mongoose'
import { z } from 'zod'
import { connectDB } from '@/lib/mongodb/client'
import { Membership } from '@/lib/mongodb/models/Membership'
import { requireOrganizationAccess } from '@/lib/tenancy/context'
import { parseWithSchema, objectIdSchema } from '@/lib/api/validation'
import { apiForbidden, apiNotFound, apiOk, apiUnauthorized } from '@/lib/api/response'
import { tenantErrorResponse } from '@/lib/tenancy/http'
import { AppError } from '@/lib/api/errors'
import { writeCriticalAudit } from '@/lib/governance/audit/service'

const transferSchema = z.object({
  newOwnerUserId: objectIdSchema,
})

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!Types.ObjectId.isValid(id)) return apiNotFound()
    const ctx = await requireOrganizationAccess(id, 'owner')

    const body = await req.json()
    const parsed = parseWithSchema(transferSchema, body)
    if (parsed.ok === false) return parsed.response

    if (String(parsed.data.newOwnerUserId) === ctx.userId) {
      throw new AppError('Already the owner', 400)
    }

    await connectDB()

    const nextOwner = await Membership.findOne({
      organizationId: id,
      userId: parsed.data.newOwnerUserId,
      status: 'active',
    })
    if (!nextOwner) throw new AppError('Target user is not an active organization member', 400)

    await Membership.updateOne(
      { organizationId: id, userId: ctx.userId },
      { $set: { role: 'admin' } }
    )
    await Membership.updateOne(
      { organizationId: id, userId: parsed.data.newOwnerUserId },
      { $set: { role: 'owner' } }
    )

    await writeCriticalAudit({
      organizationId: id,
      actorUserId: ctx.userId,
      action: 'organization.ownership_transferred',
      resourceType: 'Organization',
      resourceId: id,
      after: { newOwnerUserId: parsed.data.newOwnerUserId },
      source: 'api',
    })

    return apiOk({ success: true })
  } catch (error) {
    const status = (error as { status?: number })?.status
    if (status === 401) return apiUnauthorized()
    if (status === 403) return apiForbidden()
    return tenantErrorResponse(error)
  }
}
