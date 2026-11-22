import { Types } from 'mongoose'
import { connectDB } from '@/lib/mongodb/client'
import { Job } from '@/lib/mongodb/models/Job'
import { getActiveTenantContext, workspaceScopedFilter } from '@/lib/tenancy/context'
import { mergeMongoFilters, tenantErrorResponse } from '@/lib/tenancy/http'
import { requeueForManualRetry } from '@/lib/automation/queue/claim'
import { apiNotFound, apiOk, apiUnauthorized } from '@/lib/api/response'
import { AppError } from '@/lib/api/errors'
import { workspaceRoleAtLeast } from '@/lib/tenancy/roles'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const ctx = await getActiveTenantContext({ requireWorkspace: true })
    if (ctx.workspaceRole && !workspaceRoleAtLeast(ctx.workspaceRole, 'admin')) {
      throw new AppError('Admin access required to retry jobs', 403)
    }
    const { jobId } = await params
    if (!Types.ObjectId.isValid(jobId)) return apiNotFound()

    await connectDB()
    const job = await Job.findOne(
      mergeMongoFilters(workspaceScopedFilter(ctx), { _id: jobId })
    ).lean()
    if (!job) return apiNotFound()

    const ok = await requeueForManualRetry(jobId)
    if (!ok) throw new AppError('Only failed or dead-letter jobs can be retried', 400)
    return apiOk({ success: true })
  } catch (error) {
    if ((error as { status?: number })?.status === 401) return apiUnauthorized()
    return tenantErrorResponse(error)
  }
}
