import { connectDB } from '@/lib/mongodb/client'
import { Doc } from '@/lib/mongodb/models/Document'
import { ActivityLog } from '@/lib/mongodb/models/ActivityLog'
import {
  canAccessProject,
  findAccessibleProject,
  pickAllowedFields,
  DOC_PATCH_FIELDS,
} from '@/lib/auth/access'
import { Project } from '@/lib/mongodb/models/Project'
import { accessOptionsFromTenant, getActiveTenantContext } from '@/lib/tenancy/context'
import { isMultiTenantEnforced } from '@/lib/tenancy/flags'
import { assertResourceInWorkspace, tenantErrorResponse } from '@/lib/tenancy/http'
import { workspaceRoleAtLeast } from '@/lib/tenancy/roles'
import { NextResponse } from 'next/server'

async function canAccessDoc(
  doc: { authorId?: unknown; projectId?: unknown; workspaceId?: unknown },
  actor: { id: string; role?: string },
  opts: ReturnType<typeof accessOptionsFromTenant>
): Promise<boolean> {
  if (!assertResourceInWorkspace(doc, opts.workspaceId || null, opts.dualReadLegacy)) {
    return false
  }

  if (opts.workspaceRole && workspaceRoleAtLeast(opts.workspaceRole, 'admin')) {
    return true
  }

  const authorId =
    typeof doc.authorId === 'object' && doc.authorId !== null && '_id' in (doc.authorId as object)
      ? String((doc.authorId as { _id: unknown })._id)
      : doc.authorId
        ? String(doc.authorId)
        : ''

  if (authorId === actor.id) return true

  if (doc.projectId) {
    const projectId =
      typeof doc.projectId === 'object' && doc.projectId !== null && '_id' in (doc.projectId as object)
        ? String((doc.projectId as { _id: unknown })._id)
        : String(doc.projectId)
    const project = await Project.findById(projectId)
    return canAccessProject(project, actor, opts)
  }

  return false
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getActiveTenantContext({ requireWorkspace: isMultiTenantEnforced() })
    await connectDB()
    const { id } = await params
    const doc = await Doc.findById(id)
      .populate('authorId', 'name avatarUrl email')
      .populate('projectId', 'name color')

    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const actor = { id: ctx.userId, role: ctx.legacyRole }
    const opts = accessOptionsFromTenant(ctx)
    if (!(await canAccessDoc(doc, actor, opts))) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json(doc)
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

    const existing = await Doc.findById(id)
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (!(await canAccessDoc(existing, actor, opts))) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const updates = pickAllowedFields(body, DOC_PATCH_FIELDS)

    if (updates.projectId && typeof updates.projectId === 'string') {
      const project = await findAccessibleProject(updates.projectId, actor, opts)
      if (!project) {
        return NextResponse.json({ error: 'Cannot attach document to an inaccessible project' }, { status: 403 })
      }
    }

    const doc = await Doc.findByIdAndUpdate(id, updates, { new: true })
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await ActivityLog.create({
      actorId: ctx.userId,
      organizationId: ctx.organizationId || undefined,
      workspaceId: ctx.workspaceId || undefined,
      action: 'updated_document',
      entityType: 'document',
      entityId: doc._id,
      entityTitle: doc.title,
    })

    return NextResponse.json(doc)
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

    const doc = await Doc.findById(id)
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (!(await canAccessDoc(doc, actor, opts))) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const authorId = doc.authorId?.toString?.() || String(doc.authorId || '')
    const isWsAdmin = ctx.workspaceRole && workspaceRoleAtLeast(ctx.workspaceRole, 'admin')
    if (authorId !== ctx.userId && !isWsAdmin) {
      return NextResponse.json({ error: 'Only the author or an admin can delete this document' }, { status: 403 })
    }

    await Doc.findByIdAndDelete(id)

    await ActivityLog.create({
      actorId: ctx.userId,
      organizationId: ctx.organizationId || undefined,
      workspaceId: ctx.workspaceId || undefined,
      action: 'deleted_document',
      entityType: 'document',
      entityId: doc._id,
      entityTitle: doc.title,
    })

    return NextResponse.json({ message: 'Document deleted' })
  } catch (error) {
    return tenantErrorResponse(error, 'Internal server error')
  }
}
