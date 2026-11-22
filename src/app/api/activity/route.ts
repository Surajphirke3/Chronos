import { connectDB } from '@/lib/mongodb/client'
import { ActivityLog } from '@/lib/mongodb/models/ActivityLog'
import { Project } from '@/lib/mongodb/models/Project'
import { projectVisibilityFilter } from '@/lib/auth/access'
import {
  accessOptionsFromTenant,
  getActiveTenantContext,
  workspaceScopedFilter,
} from '@/lib/tenancy/context'
import { isMultiTenantEnforced } from '@/lib/tenancy/flags'
import { mergeMongoFilters, tenantErrorResponse } from '@/lib/tenancy/http'
import { NextResponse } from 'next/server'
import { paginationSchema, parseWithSchema } from '@/lib/api/validation'

export async function GET(req: Request) {
  try {
    const ctx = await getActiveTenantContext({ requireWorkspace: isMultiTenantEnforced() })
    await connectDB()
    const { searchParams } = new URL(req.url)
    const parsed = parseWithSchema(paginationSchema, {
      limit: searchParams.get('limit') || 20,
    })
    if (parsed.ok === false) return parsed.response

    const actor = { id: ctx.userId, role: ctx.legacyRole }
    const opts = accessOptionsFromTenant(ctx)

    const accessibleProjects = await Project.find(projectVisibilityFilter(actor, opts)).select('_id')
    const projectIds = accessibleProjects.map((p: { _id: unknown }) => p._id)

    const visibility = {
      $or: [
        { actorId: ctx.userId },
        { entityType: 'project', entityId: { $in: projectIds } },
      ],
    }

    const filter = mergeMongoFilters(workspaceScopedFilter(ctx), visibility)

    const logs = await ActivityLog.find(filter)
      .populate('actorId', 'name avatarUrl')
      .sort({ createdAt: -1, _id: -1 })
      .limit(parsed.data.limit)

    if (searchParams.get('meta') === '1') {
      return NextResponse.json({
        logs,
        pagination: {
          limit: parsed.data.limit,
          hasMore: logs.length === parsed.data.limit,
        },
      })
    }

    return NextResponse.json(logs)
  } catch (error) {
    return tenantErrorResponse(error, 'Internal server error')
  }
}
