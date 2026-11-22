import { z } from 'zod'
import { connectDB } from '@/lib/mongodb/client'
import { AutomationSchedule } from '@/lib/mongodb/models/AutomationSchedule'
import { getActiveTenantContext, workspaceScopedFilter } from '@/lib/tenancy/context'
import { mergeMongoFilters, tenantErrorResponse } from '@/lib/tenancy/http'
import { parseWithSchema } from '@/lib/api/validation'
import { apiOk, apiUnauthorized } from '@/lib/api/response'
import { AppError } from '@/lib/api/errors'
import { workspaceRoleAtLeast } from '@/lib/tenancy/roles'
import { listRegisteredJobTypes } from '@/lib/automation/registry/handlers'
import { ensureAutomationHandlersRegistered } from '@/lib/automation/registry/bootstrap'

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  scheduleType: z.enum(['once', 'interval']),
  timezone: z.string().min(1).max(64).default('UTC'),
  runAt: z.string().datetime().optional(),
  intervalMs: z.number().int().min(60_000).max(30 * 24 * 60 * 60 * 1000).optional(),
  jobType: z.string().min(3).max(120),
  jobPayloadTemplate: z.record(z.string(), z.unknown()).optional(),
})

export async function GET() {
  try {
    const ctx = await getActiveTenantContext({ requireWorkspace: true })
    await connectDB()
    const schedules = await AutomationSchedule.find(
      mergeMongoFilters(workspaceScopedFilter(ctx), { status: { $ne: 'archived' } })
    )
      .sort({ nextRunAt: 1 })
      .lean()
    return apiOk({ schedules })
  } catch (error) {
    if ((error as { status?: number })?.status === 401) return apiUnauthorized()
    return tenantErrorResponse(error)
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await getActiveTenantContext({ requireWorkspace: true })
    if (!ctx.organizationId || !ctx.workspaceId) throw new AppError('Active workspace required', 403)
    if (ctx.workspaceRole && !workspaceRoleAtLeast(ctx.workspaceRole, 'admin')) {
      throw new AppError('Admin access required', 403)
    }

    ensureAutomationHandlersRegistered()
    const body = await req.json()
    const parsed = parseWithSchema(createSchema, body)
    if (parsed.ok === false) return parsed.response

    const allowed = new Set(listRegisteredJobTypes())
    if (!allowed.has(parsed.data.jobType)) throw new AppError('Unsupported job type', 400)

    let nextRunAt: Date
    if (parsed.data.scheduleType === 'once') {
      if (!parsed.data.runAt) throw new AppError('runAt required for once schedules', 400)
      nextRunAt = new Date(parsed.data.runAt)
    } else {
      if (!parsed.data.intervalMs) throw new AppError('intervalMs required for interval schedules', 400)
      nextRunAt = new Date(Date.now() + parsed.data.intervalMs)
    }

    await connectDB()
    const schedule = await AutomationSchedule.create({
      organizationId: ctx.organizationId,
      workspaceId: ctx.workspaceId,
      createdBy: ctx.userId,
      name: parsed.data.name,
      enabled: true,
      scheduleType: parsed.data.scheduleType,
      timezone: parsed.data.timezone,
      runAt: parsed.data.runAt ? new Date(parsed.data.runAt) : undefined,
      intervalMs: parsed.data.intervalMs,
      jobType: parsed.data.jobType,
      jobPayloadTemplate: parsed.data.jobPayloadTemplate || {},
      nextRunAt,
      status: 'active',
    })

    return apiOk({ schedule }, { status: 201 })
  } catch (error) {
    if ((error as { status?: number })?.status === 401) return apiUnauthorized()
    return tenantErrorResponse(error)
  }
}
