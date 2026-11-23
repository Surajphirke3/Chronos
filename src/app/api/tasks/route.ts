import { connectDB } from '@/lib/mongodb/client'
import { Task } from '@/lib/mongodb/models/Task'
import { Project } from '@/lib/mongodb/models/Project'
import { ActivityLog } from '@/lib/mongodb/models/ActivityLog'
import { findAccessibleProject, projectVisibilityFilter } from '@/lib/auth/access'
import { accessOptionsFromTenant, getActiveTenantContext } from '@/lib/tenancy/context'
import { isMultiTenantEnforced } from '@/lib/tenancy/flags'
import { tenantErrorResponse } from '@/lib/tenancy/http'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  try {
    const ctx = await getActiveTenantContext({ requireWorkspace: isMultiTenantEnforced() })
    await connectDB()
    const actor = { id: ctx.userId, role: ctx.legacyRole }
    const opts = accessOptionsFromTenant(ctx)
    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')
    const mine = searchParams.get('mine')

    let filter: Record<string, unknown> = {}

    if (projectId) {
      const project = await findAccessibleProject(projectId, actor, opts)
      if (!project) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      filter.projectId = projectId
    } else {
      const accessibleProjects = await Project.find(projectVisibilityFilter(actor, opts)).select('_id')
      const ids = accessibleProjects.map((p: { _id: { toString: () => string } }) => p._id)
      filter.projectId = { $in: ids }
    }

    if (mine === 'true') filter.assigneeId = ctx.userId

    const tasks = await Task.find(filter)
      .populate('assigneeId', 'name avatarUrl')
      .populate('createdBy', 'name')
      .sort({ status: 1, position: 1, createdAt: -1 })

    return NextResponse.json(tasks)
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

    if (!body.projectId || typeof body.projectId !== 'string') {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    const title = typeof body.title === 'string' ? body.title.trim() : ''
    if (!title) {
      return NextResponse.json({ error: 'Task title is required' }, { status: 400 })
    }

    const project = await findAccessibleProject(body.projectId, actor, opts)
    if (!project) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const status = body.status || 'todo'
    const lastTask = await Task.findOne({
      projectId: body.projectId,
      status,
    }).sort({ position: -1 })

    const task = await Task.create({
      projectId: body.projectId,
      title,
      description: typeof body.description === 'string' ? body.description : undefined,
      status,
      priority: body.priority || 'medium',
      assigneeId: body.assigneeId || undefined,
      dueDate: body.dueDate || undefined,
      tags: Array.isArray(body.tags) ? body.tags : [],
      createdBy: ctx.userId,
      position: lastTask ? lastTask.position + 1 : 0,
    })

    await ActivityLog.create({
      actorId: ctx.userId,
      organizationId: ctx.organizationId || undefined,
      workspaceId: ctx.workspaceId || undefined,
      action: 'created_task',
      entityType: 'task',
      entityId: task._id,
      entityTitle: task.title,
    })

    return NextResponse.json(task, { status: 201 })
  } catch (error) {
    return tenantErrorResponse(error, 'Internal server error')
  }
}
