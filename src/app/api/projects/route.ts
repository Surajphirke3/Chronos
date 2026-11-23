import { connectDB } from '@/lib/mongodb/client'
import { Project } from '@/lib/mongodb/models/Project'
import { ActivityLog } from '@/lib/mongodb/models/ActivityLog'
import { projectVisibilityFilter } from '@/lib/auth/access'
import { getActiveTenantContext } from '@/lib/tenancy/context'
import { isMultiTenantEnforced } from '@/lib/tenancy/flags'
import { tenantErrorResponse } from '@/lib/tenancy/http'
import { NextResponse } from 'next/server'
import { workspaceRoleAtLeast } from '@/lib/tenancy/roles'

export async function GET() {
  try {
    const ctx = await getActiveTenantContext({ requireWorkspace: isMultiTenantEnforced() })
    if (isMultiTenantEnforced() && (!ctx.workspaceId || !ctx.workspaceRole)) {
      return NextResponse.json({ error: 'Active workspace required' }, { status: 403 })
    }

    await connectDB()
    const filter = projectVisibilityFilter(
      { id: ctx.userId, role: ctx.legacyRole },
      {
        workspaceId: ctx.workspaceId,
        workspaceRole: ctx.workspaceRole,
      }
    )

    const projects = await Project.find(filter)
      .populate('ownerId', 'name avatarUrl')
      .populate('members', 'name avatarUrl')
      .sort({ updatedAt: -1 })

    return NextResponse.json(projects)
  } catch (error) {
    return tenantErrorResponse(error, 'Internal server error')
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await getActiveTenantContext({ requireWorkspace: isMultiTenantEnforced() })
    if (ctx.workspaceRole && !workspaceRoleAtLeast(ctx.workspaceRole, 'member')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()
    const body = await req.json()

    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 })
    }

    const memberIds = Array.isArray(body.members)
      ? body.members.filter((id: unknown) => typeof id === 'string' && id.length > 0)
      : []

    const project = await Project.create({
      name,
      description: typeof body.description === 'string' ? body.description : undefined,
      status: body.status === 'paused' || body.status === 'done' ? body.status : 'active',
      color: typeof body.color === 'string' ? body.color : undefined,
      dueDate: body.dueDate || undefined,
      organizationId: ctx.organizationId || undefined,
      workspaceId: ctx.workspaceId || undefined,
      ownerId: ctx.userId,
      members: Array.from(new Set([ctx.userId, ...memberIds])),
    })

    await ActivityLog.create({
      actorId: ctx.userId,
      organizationId: ctx.organizationId || undefined,
      workspaceId: ctx.workspaceId || undefined,
      action: 'created_project',
      entityType: 'project',
      entityId: project._id,
      entityTitle: project.name,
    })

    return NextResponse.json(project, { status: 201 })
  } catch (error) {
    return tenantErrorResponse(error, 'Internal server error')
  }
}
