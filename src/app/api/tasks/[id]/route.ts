import { connectDB } from '@/lib/mongodb/client'
import { Task } from '@/lib/mongodb/models/Task'
import { ActivityLog } from '@/lib/mongodb/models/ActivityLog'
import {
  findAccessibleProject,
  pickAllowedFields,
  TASK_PATCH_FIELDS,
} from '@/lib/auth/access'
import { accessOptionsFromTenant, getActiveTenantContext } from '@/lib/tenancy/context'
import { isMultiTenantEnforced } from '@/lib/tenancy/flags'
import { tenantErrorResponse } from '@/lib/tenancy/http'
import { NextResponse } from 'next/server'

async function assertTaskAccess(
  task: { projectId: unknown },
  actor: { id: string; role?: string },
  opts: ReturnType<typeof accessOptionsFromTenant>
) {
  const projectId =
    typeof task.projectId === 'object' && task.projectId !== null && '_id' in (task.projectId as object)
      ? String((task.projectId as { _id: unknown })._id)
      : String(task.projectId)
  return findAccessibleProject(projectId, actor, opts)
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getActiveTenantContext({ requireWorkspace: isMultiTenantEnforced() })
    await connectDB()
    const { id } = await params
    const task = await Task.findById(id)
      .populate('assigneeId', 'name avatarUrl email')
      .populate('createdBy', 'name')
      .populate('projectId', 'name color')

    if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const actor = { id: ctx.userId, role: ctx.legacyRole }
    const opts = accessOptionsFromTenant(ctx)
    if (!(await assertTaskAccess(task, actor, opts))) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json(task)
  } catch (error) {
    return tenantErrorResponse(error, 'Internal server error')
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getActiveTenantContext({ requireWorkspace: isMultiTenantEnforced() })
    await connectDB()
    const { id } = await params
    const body = await req.json()
    const actor = { id: ctx.userId, role: ctx.legacyRole }
    const opts = accessOptionsFromTenant(ctx)

    const oldTask = await Task.findById(id)
    if (!oldTask) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (!(await assertTaskAccess(oldTask, actor, opts))) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const updates = pickAllowedFields(body, TASK_PATCH_FIELDS)

    if (updates.projectId && typeof updates.projectId === 'string') {
      const target = await findAccessibleProject(updates.projectId, actor, opts)
      if (!target) {
        return NextResponse.json({ error: 'Cannot move task to an inaccessible project' }, { status: 403 })
      }
    }

    const task = await Task.findByIdAndUpdate(id, updates, { new: true })

    if (body.status && body.status !== oldTask.status) {
      await ActivityLog.create({
        actorId: ctx.userId,
        organizationId: ctx.organizationId || undefined,
        workspaceId: ctx.workspaceId || undefined,
        action: 'moved_task',
        entityType: 'task',
        entityId: task!._id,
        entityTitle: task!.title,
        metadata: { from: oldTask.status, to: body.status },
      })
    } else {
      await ActivityLog.create({
        actorId: ctx.userId,
        organizationId: ctx.organizationId || undefined,
        workspaceId: ctx.workspaceId || undefined,
        action: 'updated_task',
        entityType: 'task',
        entityId: task!._id,
        entityTitle: task!.title,
      })
    }

    return NextResponse.json(task)
  } catch (error) {
    return tenantErrorResponse(error, 'Internal server error')
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getActiveTenantContext({ requireWorkspace: isMultiTenantEnforced() })
    await connectDB()
    const { id } = await params
    const actor = { id: ctx.userId, role: ctx.legacyRole }
    const opts = accessOptionsFromTenant(ctx)

    const task = await Task.findById(id)
    if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (!(await assertTaskAccess(task, actor, opts))) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await Task.findByIdAndDelete(id)

    await ActivityLog.create({
      actorId: ctx.userId,
      organizationId: ctx.organizationId || undefined,
      workspaceId: ctx.workspaceId || undefined,
      action: 'deleted_task',
      entityType: 'task',
      entityId: task._id,
      entityTitle: task.title,
    })

    return NextResponse.json({ message: 'Task deleted' })
  } catch (error) {
    return tenantErrorResponse(error, 'Internal server error')
  }
}
