import { z } from 'zod'
import { connectDB } from '@/lib/mongodb/client'
import { Invitation } from '@/lib/mongodb/models/Invitation'
import { Organization } from '@/lib/mongodb/models/Organization'
import { Workspace } from '@/lib/mongodb/models/Workspace'
import { hashInviteToken } from '@/lib/tenancy/invitations'
import { parseWithSchema } from '@/lib/api/validation'
import { apiOk, apiTooMany } from '@/lib/api/response'
import { tenantErrorResponse } from '@/lib/tenancy/http'
import { AppError } from '@/lib/api/errors'
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/security/rateLimit'

const schema = z.object({
  token: z.string().min(16).max(200),
})

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req)
    const rate = await checkRateLimit(
      `invite-preview:${ip}`,
      RATE_LIMITS.invitationPreview.limit,
      RATE_LIMITS.invitationPreview.windowMs
    )
    if (!rate.allowed) {
      return apiTooMany('Too many attempts', Math.ceil(rate.retryAfterMs / 1000))
    }

    const body = await req.json()
    const parsed = parseWithSchema(schema, body)
    if (parsed.ok === false) return parsed.response

    await connectDB()
    const tokenHash = hashInviteToken(parsed.data.token)
    const invitation = await Invitation.findOne({ tokenHash }).select('-tokenHash').lean()

    if (!invitation) {
      throw new AppError('Invitation not found', 404)
    }

    const expired = invitation.expiresAt && new Date(invitation.expiresAt) <= new Date()
    const status = expired && invitation.status === 'pending' ? 'expired' : invitation.status

    const [org, workspace] = await Promise.all([
      Organization.findById(invitation.organizationId).select('name slug').lean(),
      invitation.workspaceId
        ? Workspace.findById(invitation.workspaceId).select('name slug').lean()
        : null,
    ])

    return apiOk({
      status,
      email: invitation.email,
      role: invitation.role,
      scope: invitation.scope,
      expiresAt: invitation.expiresAt,
      organization: org,
      workspace,
    })
  } catch (error) {
    return tenantErrorResponse(error)
  }
}
