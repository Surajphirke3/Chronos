import { connectDB } from '@/lib/mongodb/client'
import { Project } from '@/lib/mongodb/models/Project'
import { Task } from '@/lib/mongodb/models/Task'
import { ActivityLog } from '@/lib/mongodb/models/ActivityLog'
import {
  canAccessProject,
  pickAllowedFields,
  PROJECT_PATCH_FIELDS,
} from '@/lib/auth/access'
import { accessOptionsFromTenant, getActiveTenantContext } from '@/lib/tenancy/context'
import { isMultiTenantEnforced } from '@/lib/tenancy/flags'
import { tenantErrorResponse } from '@/lib/tenancy/http'
import { workspaceRoleAtLeast } from '@/lib/tenancy/roles'
import { NextResponse } from 'next/server'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getActiveTenantContext({ requireWorkspace: isMultiTenantEnforced() })
    await connectDB()
    const { id } = await params
    const project = await Project.findById(id)
      .populate('ownerId', 'name avatarUrl email')
      .populate('members', 'name avatarUrl email title')

    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const opts = accessOptionsFromTenant(ctx)
    if (!canAccessProject(project, { id: ctx.userId, role: ctx.legacyRole }, opts)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const taskStats = await Task.aggregate([
      { $match: { projectId: project._id } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ])

    return NextResponse.json({ ...project.toObject(), taskStats })
  } catch (error) {
    return tenantErrorResponse(error, 'Internal server error')
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getActiveTenantContext({ requireWorkspace: isMultiTenantEnforced() })
    await connectDB()
    const { id } = await params
    const existing = await Project.findById(id)
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const actor = { id: ctx.userId, role: ctx.legacyRole }
    const opts = accessOptionsFromTenant(ctx)
    if (!canAccessProject(existing, actor, opts)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const ownerId = existing.ownerId?.toString?.() || String(existing.ownerId)
    const isWsAdmin = ctx.workspaceRole && workspaceRoleAtLeast(ctx.workspaceRole, 'admin')
    // Legacy User.role=admin must not mutate across tenants; use workspace role only
    if (ownerId !== ctx.userId && !isWsAdmin) {
      return NextResponse.json({ error: 'Only the project owner or an admin can update this project' }, { status: 403 })
    }

    const body = await req.json()
    const updates = pickAllowedFields(body, PROJECT_PATCH_FIELDS)

    const project = await Project.findByIdAndUpdate(id, updates, { new: true })
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await ActivityLog.create({
      actorId: ctx.userId,
      organizationId: ctx.organizationId || undefined,
      workspaceId: ctx.workspaceId || undefined,
      action: 'updated_project',
      entityType: 'project',
      entityId: project._id,
      entityTitle: project.name,
    })

    return NextResponse.json(project)
  } catch (error) {
    return tenantErrorResponse(error, 'Internal server error')
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getActiveTenantContext({ requireWorkspace: isMultiTenantEnforced() })
    await connectDB()
    const { id } = await params

    const project = await Project.findById(id)
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const opts = accessOptionsFromTenant(ctx)
    if (!canAccessProject(project, { id: ctx.userId, role: ctx.legacyRole }, opts)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const isWsAdmin = ctx.workspaceRole && workspaceRoleAtLeast(ctx.workspaceRole, 'admin')
    if (project.ownerId.toString() !== ctx.userId && !isWsAdmin) {
      return NextResponse.json({ error: 'Not authorized to delete this project' }, { status: 403 })
    }

    await Task.deleteMany({ projectId: id })
    await Project.findByIdAndDelete(id)

    await ActivityLog.create({
      actorId: ctx.userId,
      organizationId: ctx.organizationId || undefined,
      workspaceId: ctx.workspaceId || undefined,
      action: 'deleted_project',
      entityType: 'project',
      entityId: project._id,
      entityTitle: project.name,
    })

    return NextResponse.json({ message: 'Project deleted' })
  } catch (error) {
    return tenantErrorResponse(error, 'Internal server error')
  }
}
