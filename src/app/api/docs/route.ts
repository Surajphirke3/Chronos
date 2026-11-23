import { connectDB } from '@/lib/mongodb/client'
import { Doc } from '@/lib/mongodb/models/Document'
import { Project } from '@/lib/mongodb/models/Project'
import { ActivityLog } from '@/lib/mongodb/models/ActivityLog'
import { findAccessibleProject, projectVisibilityFilter } from '@/lib/auth/access'
import {
  accessOptionsFromTenant,
  getActiveTenantContext,
  workspaceScopedFilter,
} from '@/lib/tenancy/context'
import { isMultiTenantEnforced } from '@/lib/tenancy/flags'
import { mergeMongoFilters, tenantErrorResponse } from '@/lib/tenancy/http'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  try {
    const ctx = await getActiveTenantContext({ requireWorkspace: isMultiTenantEnforced() })
    await connectDB()
    const actor = { id: ctx.userId, role: ctx.legacyRole }
    const opts = accessOptionsFromTenant(ctx)
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search')
    const type = searchParams.get('type')

    const accessibleProjects = await Project.find(projectVisibilityFilter(actor, opts)).select('_id')
    const projectIds = accessibleProjects.map((p: { _id: { toString: () => string } }) => p._id)

    const visibility: Record<string, unknown> = {
      $or: [{ authorId: ctx.userId }, { projectId: { $in: projectIds } }],
    }

    const filter = mergeMongoFilters(workspaceScopedFilter(ctx), visibility)
    if (type) (filter as Record<string, unknown>).type = type
    if (search) (filter as Record<string, unknown>).$text = { $search: search }

    const docs = await Doc.find(filter)
      .populate('authorId', 'name avatarUrl')
      .populate('projectId', 'name color')
      .sort({ isPinned: -1, updatedAt: -1 })

    return NextResponse.json(docs)
  } catch (error) {
    return tenantErrorResponse(error, 'Internal server error')
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await getActiveTenantContext({ requireWorkspace: isMultiTenantEnforced() })
    await connectDB()
    const body = await req.json()
    const actor = { id: ctx.userId, role: ctx.legacyRole }
    const opts = accessOptionsFromTenant(ctx)

    const title = typeof body.title === 'string' ? body.title.trim() : ''
    if (!title) {
      return NextResponse.json({ error: 'Document title is required' }, { status: 400 })
    }

    if (body.projectId) {
      const project = await findAccessibleProject(String(body.projectId), actor, opts)
      if (!project) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const doc = await Doc.create({
      title,
      content: body.content,
      type: body.type || 'general',
      projectId: body.projectId || undefined,
      isPinned: Boolean(body.isPinned),
      authorId: ctx.userId,
      organizationId: ctx.organizationId || undefined,
      workspaceId: ctx.workspaceId || undefined,
    })

    await ActivityLog.create({
      actorId: ctx.userId,
      organizationId: ctx.organizationId || undefined,
      workspaceId: ctx.workspaceId || undefined,
      action: 'created_document',
      entityType: 'document',
      entityId: doc._id,
      entityTitle: doc.title,
    })

    return NextResponse.json(doc, { status: 201 })
  } catch (error) {
    return tenantErrorResponse(error, 'Internal server error')
  }
}
