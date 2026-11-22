import { Types } from 'mongoose'
import { connectDB } from '@/lib/mongodb/client'
import { Job } from '@/lib/mongodb/models/Job'
import { getActiveTenantContext, workspaceScopedFilter } from '@/lib/tenancy/context'
import { mergeMongoFilters, tenantErrorResponse } from '@/lib/tenancy/http'
import { apiNotFound, apiOk, apiUnauthorized } from '@/lib/api/response'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const ctx = await getActiveTenantContext({ requireWorkspace: true })
    const { jobId } = await params
    if (!Types.ObjectId.isValid(jobId)) return apiNotFound()

    await connectDB()
    const job = await Job.findOne(
      mergeMongoFilters(workspaceScopedFilter(ctx), { _id: jobId })
    )
      .select('-payload.aiApiKey -payload.smtpPass')
      .lean()

    if (!job) return apiNotFound()
    return apiOk({ job })
  } catch (error) {
    if ((error as { status?: number })?.status === 401) return apiUnauthorized()
    return tenantErrorResponse(error)
  }
}
