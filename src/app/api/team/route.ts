import { connectDB } from '@/lib/mongodb/client'
import { User } from '@/lib/mongodb/models/User'
import { WorkspaceMembership } from '@/lib/mongodb/models/WorkspaceMembership'
import { Membership } from '@/lib/mongodb/models/Membership'
import { getActiveTenantContext } from '@/lib/tenancy/context'
import { isMultiTenantEnforced } from '@/lib/tenancy/flags'
import { tenantErrorResponse } from '@/lib/tenancy/http'
import { orgRoleAtLeast } from '@/lib/tenancy/roles'
import { NextResponse } from 'next/server'
import { AppError } from '@/lib/api/errors'

export async function GET() {
  try {
    const ctx = await getActiveTenantContext({ requireWorkspace: isMultiTenantEnforced() })
    await connectDB()

    // Prefer workspace directory; fall back to org members; never list global users
    if (ctx.workspaceId) {
      const memberships = await WorkspaceMembership.find({
        workspaceId: ctx.workspaceId,
        status: 'active',
      }).lean()
      const userIds = memberships.map((m: { userId: unknown }) => m.userId)
      const users = await User.find({ _id: { $in: userIds }, isActive: true })
        .select('-password')
        .sort({ name: 1 })
        .lean()

      const roleByUser = new Map(
        memberships.map((m: { userId: { toString: () => string }; role: string }) => [
          String(m.userId),
          m.role,
        ])
      )

      return NextResponse.json(
        users.map((u: { _id: { toString: () => string } }) => ({
          ...u,
          workspaceRole: roleByUser.get(String(u._id)) || 'member',
        }))
      )
    }

    if (ctx.organizationId) {
      const memberships = await Membership.find({
        organizationId: ctx.organizationId,
        status: 'active',
      }).lean()
      const userIds = memberships.map((m: { userId: unknown }) => m.userId)
      const users = await User.find({ _id: { $in: userIds }, isActive: true })
        .select('-password')
        .sort({ name: 1 })
      return NextResponse.json(users)
    }

    // Legacy dual-read: only self when no tenant context
    const self = await User.findById(ctx.userId).select('-password')
    return NextResponse.json(self ? [self] : [])
  } catch (error) {
    return tenantErrorResponse(error, 'Internal server error')
  }
}

export async function PATCH(req: Request) {
  try {
    const ctx = await getActiveTenantContext({ requireWorkspace: false })
    if (!ctx.organizationId || !ctx.orgRole || !orgRoleAtLeast(ctx.orgRole, 'admin')) {
      throw new AppError('Admin access required', 403)
    }

    await connectDB()
    const { userId, title } = await req.json()

    // Do not allow changing global User.role / platformRole via team API
    const membership = await Membership.findOne({
      organizationId: ctx.organizationId,
      userId,
      status: 'active',
    })
    if (!membership) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { ...(title && { title }) },
      { new: true }
    ).select('-password')

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    return NextResponse.json(user)
  } catch (error) {
    return tenantErrorResponse(error, 'Internal server error')
  }
}
