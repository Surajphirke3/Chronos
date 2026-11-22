import { z } from 'zod'
import { connectDB } from '@/lib/mongodb/client'
import { Invitation } from '@/lib/mongodb/models/Invitation'
import { Organization } from '@/lib/mongodb/models/Organization'
import { User } from '@/lib/mongodb/models/User'
import { requireOrganizationAccess, requireWorkspaceAccess } from '@/lib/tenancy/context'
import { createInvitation } from '@/lib/tenancy/invitations'
import { sendInvitationEmail } from '@/lib/tenancy/mail'
import { parseWithSchema, objectIdSchema } from '@/lib/api/validation'
import { apiOk, apiTooMany, apiUnauthorized } from '@/lib/api/response'
import { tenantErrorResponse } from '@/lib/tenancy/http'
import { checkRateLimit, RATE_LIMITS } from '@/lib/security/rateLimit'
import { AppError } from '@/lib/api/errors'

const createSchema = z.object({
  organizationId: objectIdSchema,
  workspaceId: objectIdSchema.optional().nullable(),
  email: z.string().email(),
  role: z.enum(['admin', 'member', 'guest']).default('member'),
  scope: z.enum(['organization', 'workspace']).default('workspace'),
})

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const organizationId = searchParams.get('organizationId')
    if (!organizationId) throw new AppError('organizationId is required', 400)

    await requireOrganizationAccess(organizationId, 'admin')
    await connectDB()

    const invitations = await Invitation.find({
      organizationId,
      status: 'pending',
    })
      .select('-tokenHash')
      .sort({ createdAt: -1 })
      .lean()

    return apiOk({ invitations })
  } catch (error) {
    if ((error as { status?: number })?.status === 401) return apiUnauthorized()
    return tenantErrorResponse(error)
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const parsed = parseWithSchema(createSchema, body)
    if (parsed.ok === false) return parsed.response

    const rate = await checkRateLimit(
      `invite:${parsed.data.organizationId}`,
      RATE_LIMITS.invitationCreate.limit,
      RATE_LIMITS.invitationCreate.windowMs
    )
    if (!rate.allowed) {
      return apiTooMany('Too many invitations', Math.ceil(rate.retryAfterMs / 1000))
    }

    let actorUserId: string
    let actorOrgRole: string
    let actorWorkspaceRole: string | null = null

    if (parsed.data.scope === 'workspace') {
      if (!parsed.data.workspaceId) throw new AppError('workspaceId required for workspace invites', 400)
      const wsCtx = await requireWorkspaceAccess(parsed.data.workspaceId, 'admin')
      if (wsCtx.organizationId !== parsed.data.organizationId) {
        throw new AppError('Workspace does not belong to organization', 400)
      }
      actorUserId = wsCtx.userId
      actorOrgRole = wsCtx.orgRole
      actorWorkspaceRole = wsCtx.workspaceRole
    } else {
      const orgCtx = await requireOrganizationAccess(parsed.data.organizationId, 'admin')
      actorUserId = orgCtx.userId
      actorOrgRole = orgCtx.orgRole
    }

    const result = await createInvitation({
      organizationId: parsed.data.organizationId,
      workspaceId: parsed.data.workspaceId,
      email: parsed.data.email,
      role: parsed.data.role,
      scope: parsed.data.scope,
      invitedBy: actorUserId,
      actorOrgRole,
      actorWorkspaceRole,
    })

    await connectDB()
    const [org, inviter] = await Promise.all([
      Organization.findById(parsed.data.organizationId).select('name').lean(),
      User.findById(actorUserId).select('name').lean(),
    ])

    const baseUrl = process.env.NEXTAUTH_URL || process.env.APP_URL || 'http://localhost:3000'
    const inviteUrl = `${baseUrl.replace(/\/$/, '')}/invite/${result.token}`

    const emailResult = await sendInvitationEmail({
      to: parsed.data.email,
      organizationName: org?.name || 'Chronos organization',
      inviterName: inviter?.name || 'A teammate',
      inviteUrl,
      expiresAt: result.expiresAt,
    })

    if (!emailResult.sent) {
      await Invitation.updateOne({ _id: result.invitationId }, { $set: { status: 'revoked' } })
      throw new AppError(emailResult.error || 'Invitation email failed', 502)
    }

    return apiOk(
      {
        invitationId: result.invitationId,
        expiresAt: result.expiresAt,
        emailSent: true,
      },
      { status: 201 }
    )
  } catch (error) {
    if ((error as { status?: number })?.status === 401) return apiUnauthorized()
    return tenantErrorResponse(error, 'Failed to create invitation')
  }
}
