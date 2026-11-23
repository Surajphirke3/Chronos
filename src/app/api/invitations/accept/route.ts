import { z } from 'zod'
import { acceptInvitation } from '@/lib/tenancy/invitations'
import { requireAuthenticatedUser } from '@/lib/tenancy/context'
import { parseWithSchema } from '@/lib/api/validation'
import { apiOk, apiTooMany, apiUnauthorized } from '@/lib/api/response'
import { tenantErrorResponse } from '@/lib/tenancy/http'
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/security/rateLimit'

const schema = z.object({
  token: z.string().min(16).max(200),
})

export async function POST(req: Request) {
  try {
    const auth = await requireAuthenticatedUser()
    const ip = getClientIp(req)
    const rate = await checkRateLimit(
      `invite-accept:${auth.userId}:${ip}`,
      RATE_LIMITS.invitationAccept.limit,
      RATE_LIMITS.invitationAccept.windowMs
    )
    if (!rate.allowed) {
      return apiTooMany('Too many attempts', Math.ceil(rate.retryAfterMs / 1000))
    }

    const body = await req.json()
    const parsed = parseWithSchema(schema, body)
    if (parsed.ok === false) return parsed.response

    const result = await acceptInvitation({
      token: parsed.data.token,
      userId: auth.userId,
      userEmail: auth.email,
    })

    return apiOk(result)
  } catch (error) {
    if ((error as { status?: number })?.status === 401) return apiUnauthorized()
    return tenantErrorResponse(error)
  }
}
