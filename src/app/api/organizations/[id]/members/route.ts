import { Types } from 'mongoose'
import { z } from 'zod'
import { connectDB } from '@/lib/mongodb/client'
import { Membership } from '@/lib/mongodb/models/Membership'
import { WorkspaceMembership } from '@/lib/mongodb/models/WorkspaceMembership'
import { User } from '@/lib/mongodb/models/User'
import { requireOrganizationAccess } from '@/lib/tenancy/context'
import { parseWithSchema, objectIdSchema } from '@/lib/api/validation'
import { apiForbidden, apiNotFound, apiOk, apiUnauthorized } from '@/lib/api/response'
import { tenantErrorResponse } from '@/lib/tenancy/http'
import { AppError } from '@/lib/api/errors'

const removeSchema = z.object({
  userId: objectIdSchema,
})

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!Types.ObjectId.isValid(id)) return apiNotFound()
    await requireOrganizationAccess(id, 'member')
    await connectDB()

    const memberships = await Membership.find({
      organizationId: id,
      status: 'active',
    }).lean()

    const userIds = memberships.map((m: { userId: unknown }) => m.userId)
    const users = await User.find({ _id: { $in: userIds } })
      .select('name email avatarUrl title isActive')
      .lean()

    const userMap = new Map(users.map((u: { _id: { toString: () => string } }) => [String(u._id), u]))

    const members = memberships.map(
      (m: { userId: { toString: () => string }; role: string; status: string; joinedAt?: Date }) => ({
        user: userMap.get(String(m.userId)) || null,
        role: m.role,
        status: m.status,
        joinedAt: m.joinedAt,
      })
    )

    return apiOk({ members })
  } catch (error) {
    const status = (error as { status?: number })?.status
    if (status === 401) return apiUnauthorized()
    if (status === 403) return apiForbidden()
    return tenantErrorResponse(error)
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!Types.ObjectId.isValid(id)) return apiNotFound()
    const ctx = await requireOrganizationAccess(id, 'admin')

    const body = await req.json()
    const parsed = parseWithSchema(removeSchema, body)
    if (parsed.ok === false) return parsed.response

    await connectDB()
    const target = await Membership.findOne({
      organizationId: id,
      userId: parsed.data.userId,
      status: 'active',
    })

    if (!target) return apiNotFound('Membership not found')
    if (target.role === 'owner') {
      throw new AppError('Organization owner cannot be removed', 403)
    }
    if (String(parsed.data.userId) === ctx.userId) {
      throw new AppError('Cannot remove yourself; transfer ownership or leave via a dedicated flow', 400)
    }

    target.status = 'removed'
    await target.save()

    await WorkspaceMembership.updateMany(
      { organizationId: id, userId: parsed.data.userId, status: 'active' },
      { $set: { status: 'removed' } }
    )

    await User.updateOne(
      {
        _id: parsed.data.userId,
        activeOrganizationId: id,
      },
      { $unset: { activeOrganizationId: 1, activeWorkspaceId: 1 } }
    )

    return apiOk({ success: true })
  } catch (error) {
    const status = (error as { status?: number })?.status
    if (status === 401) return apiUnauthorized()
    if (status === 403) return apiForbidden()
    return tenantErrorResponse(error)
  }
}
