import { z } from 'zod'
import { connectDB } from '@/lib/mongodb/client'
import { Job } from '@/lib/mongodb/models/Job'
import { getActiveTenantContext, workspaceScopedFilter } from '@/lib/tenancy/context'
import { isMultiTenantEnforced } from '@/lib/tenancy/flags'
import { mergeMongoFilters, tenantErrorResponse } from '@/lib/tenancy/http'
import { enqueueJob } from '@/lib/automation/queue/enqueue'
import { ensureAutomationHandlersRegistered } from '@/lib/automation/registry/bootstrap'
import { listRegisteredJobTypes } from '@/lib/automation/registry/handlers'
import { parseWithSchema, paginationSchema } from '@/lib/api/validation'
import { apiOk, apiUnauthorized } from '@/lib/api/response'
import { AppError } from '@/lib/api/errors'
import { checkRateLimit } from '@/lib/security/rateLimit'
import { workspaceRoleAtLeast } from '@/lib/tenancy/roles'

const createSchema = z.object({
  jobType: z.string().min(3).max(120),
  payload: z.record(z.string(), z.unknown()).optional(),
  idempotencyKey: z.string().min(1).max(200).optional(),
  priority: z.number().int().min(-100).max(1000).optional(),
  availableAt: z.string().datetime().optional(),
})

export async function GET(req: Request) {
  try {
    const ctx = await getActiveTenantContext({ requireWorkspace: isMultiTenantEnforced() })
    if (!ctx.workspaceId) throw new AppError('Active workspace required', 403)

    const { searchParams } = new URL(req.url)
    const parsed = parseWithSchema(paginationSchema, {
      limit: searchParams.get('limit') || 30,
      page: searchParams.get('page') || 1,
    })
    if (parsed.ok === false) return parsed.response

    const status = searchParams.get('status')
    await connectDB()
    const filter = mergeMongoFilters(workspaceScopedFilter(ctx), {
      ...(status ? { status } : {}),
    })
    const page = parsed.data.page || 1
    const skip = (page - 1) * parsed.data.limit

    const [jobs, total] = await Promise.all([
      Job.find(filter)
        .select('-payload.aiApiKey -payload.smtpPass')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parsed.data.limit)
        .lean(),
      Job.countDocuments(filter),
    ])

    return apiOk({
      jobs,
      pagination: {
        page,
        limit: parsed.data.limit,
        total,
        totalPages: Math.ceil(total / parsed.data.limit) || 1,
      },
      registeredJobTypes: ensureAutomationHandlersRegistered(),
    })
  } catch (error) {
    if ((error as { status?: number })?.status === 401) return apiUnauthorized()
    return tenantErrorResponse(error)
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await getActiveTenantContext({ requireWorkspace: true })
    if (!ctx.organizationId || !ctx.workspaceId) {
      throw new AppError('Active workspace required', 403)
    }
    if (ctx.workspaceRole && !workspaceRoleAtLeast(ctx.workspaceRole, 'member')) {
      throw new AppError('Forbidden', 403)
    }

    const rate = await checkRateLimit(`jobs:create:${ctx.userId}`, 30, 60 * 1000)
    if (!rate.allowed) throw new AppError('Too many jobs', 429)

    ensureAutomationHandlersRegistered()
    const body = await req.json()
    const parsed = parseWithSchema(createSchema, body)
    if (parsed.ok === false) return parsed.response

    const allowed = new Set(listRegisteredJobTypes())
    if (!allowed.has(parsed.data.jobType)) {
      throw new AppError('Unsupported job type', 400)
    }

    // Disallow client enqueue of schedule tick
    if (parsed.data.jobType === 'automation.schedule.tick') {
      throw new AppError('Unsupported job type', 400)
    }

    const { job, created } = await enqueueJob({
      organizationId: ctx.organizationId,
      workspaceId: ctx.workspaceId,
      initiatedBy: ctx.userId,
      jobType: parsed.data.jobType,
      payload: parsed.data.payload || {},
      idempotencyKey: parsed.data.idempotencyKey,
      priority: parsed.data.priority,
      availableAt: parsed.data.availableAt ? new Date(parsed.data.availableAt) : undefined,
    })

    return apiOk({ job, created }, { status: created ? 201 : 200 })
  } catch (error) {
    if ((error as { status?: number })?.status === 401) return apiUnauthorized()
    return tenantErrorResponse(error)
  }
}
