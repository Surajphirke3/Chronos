import { Types } from 'mongoose'
import { connectDB } from '@/lib/mongodb/client'
import { Invitation } from '@/lib/mongodb/models/Invitation'
import { requireOrganizationAccess } from '@/lib/tenancy/context'
import { apiForbidden, apiNotFound, apiOk, apiUnauthorized } from '@/lib/api/response'
import { tenantErrorResponse } from '@/lib/tenancy/http'
import { AppError } from '@/lib/api/errors'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!Types.ObjectId.isValid(id)) return apiNotFound()

    await connectDB()
    const invitation = await Invitation.findById(id)
    if (!invitation || invitation.status !== 'pending') return apiNotFound()

    await requireOrganizationAccess(String(invitation.organizationId), 'admin')
    invitation.status = 'revoked'
    await invitation.save()

    return apiOk({ success: true })
  } catch (error) {
    const status = (error as { status?: number })?.status
    if (status === 401) return apiUnauthorized()
    if (status === 403) return apiForbidden()
    return tenantErrorResponse(error instanceof AppError ? error : error)
  }
}
