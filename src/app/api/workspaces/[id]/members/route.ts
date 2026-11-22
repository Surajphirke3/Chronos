import { Types } from 'mongoose'
import { z } from 'zod'
import { connectDB } from '@/lib/mongodb/client'
import { Membership } from '@/lib/mongodb/models/Membership'
import { WorkspaceMembership } from '@/lib/mongodb/models/WorkspaceMembership'
import { User } from '@/lib/mongodb/models/User'
import { requireWorkspaceAccess } from '@/lib/tenancy/context'
import { canAssignWorkspaceRole } from '@/lib/tenancy/roles'
import { parseWithSchema, objectIdSchema } from '@/lib/api/validation'
import { apiForbidden, apiNotFound, apiOk, apiUnauthorized } from '@/lib/api/response'
import { tenantErrorResponse } from '@/lib/tenancy/http'
import { AppError } from '@/lib/api/errors'

const addSchema = z.object({
  userId: objectIdSchema,
  role: z.enum(['admin', 'member', 'guest']).default('member'),
})

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
    await requireWorkspaceAccess(id, 'guest')
    await connectDB()

    const memberships = await WorkspaceMembership.find({
      workspaceId: id,
      status: 'active',
    }).lean()

    const userIds = memberships.map((m: { userId: unknown }) => m.userId)
    const users = await User.find({ _id: { $in: userIds } })
      .select('name email avatarUrl title')
      .lean()
    const userMap = new Map(users.map((u: { _id: { toString: () => string } }) => [String(u._id), u]))

    return apiOk({
      members: memberships.map(
        (m: { userId: { toString: () => string }; role: string; status: string; joinedAt?: Date }) => ({
          user: userMap.get(String(m.userId)) || null,
          role: m.role,
          status: m.status,
          joinedAt: m.joinedAt,
        })
      ),
    })
  } catch (error) {
    const status = (error as { status?: number })?.status
    if (status === 401) return apiUnauthorized()
    if (status === 403) return apiForbidden()
    return tenantErrorResponse(error)
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!Types.ObjectId.isValid(id)) return apiNotFound()
    const ctx = await requireWorkspaceAccess(id, 'admin')

    const body = await req.json()
    const parsed = parseWithSchema(addSchema, body)
    if (parsed.ok === false) return parsed.response

    if (!canAssignWorkspaceRole(ctx.workspaceRole, parsed.data.role)) {
      throw new AppError('Cannot assign this workspace role', 403)
    }

    await connectDB()
    const orgMember = await Membership.findOne({
      organizationId: ctx.organizationId,
      userId: parsed.data.userId,
      status: 'active',
    }).lean()
    if (!orgMember) {
      throw new AppError('User must be an active organization member first', 400)
    }

    await WorkspaceMembership.findOneAndUpdate(
      { workspaceId: id, userId: parsed.data.userId },
      {
        $set: {
          organizationId: ctx.organizationId,
          status: 'active',
          role: parsed.data.role,
          joinedAt: new Date(),
          invitedBy: ctx.userId,
        },
        $setOnInsert: {
          workspaceId: id,
          userId: parsed.data.userId,
        },
      },
      { upsert: true }
    )

    return apiOk({ success: true }, { status: 201 })
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
    const ctx = await requireWorkspaceAccess(id, 'admin')

    const body = await req.json()
    const parsed = parseWithSchema(removeSchema, body)
    if (parsed.ok === false) return parsed.response

    await connectDB()
    const target = await WorkspaceMembership.findOne({
      workspaceId: id,
      userId: parsed.data.userId,
      status: 'active',
    })
    if (!target) return apiNotFound()
    if (target.role === 'owner') {
      throw new AppError('Workspace owner cannot be removed this way', 403)
    }

    target.status = 'removed'
    await target.save()

    await User.updateOne(
      { _id: parsed.data.userId, activeWorkspaceId: id },
      { $unset: { activeWorkspaceId: 1 } }
    )

    return apiOk({ success: true })
  } catch (error) {
    const status = (error as { status?: number })?.status
    if (status === 401) return apiUnauthorized()
    if (status === 403) return apiForbidden()
    return tenantErrorResponse(error)
  }
}
