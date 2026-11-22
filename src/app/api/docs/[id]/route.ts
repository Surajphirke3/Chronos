import { connectDB } from '@/lib/mongodb/client'
import { Doc } from '@/lib/mongodb/models/Document'
import { ActivityLog } from '@/lib/mongodb/models/ActivityLog'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import {
  canAccessProject,
  findAccessibleProject,
  pickAllowedFields,
  DOC_PATCH_FIELDS,
} from '@/lib/auth/access'
import { Project } from '@/lib/mongodb/models/Project'
import { NextResponse } from 'next/server'

async function canAccessDoc(
  doc: { authorId?: unknown; projectId?: unknown },
  actor: { id: string; role?: string }
): Promise<boolean> {
  if (actor.role === 'admin') return true

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
    return canAccessProject(project, actor)
  }

  return false
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()
    const { id } = await params
    const doc = await Doc.findById(id)
      .populate('authorId', 'name avatarUrl email')
      .populate('projectId', 'name color')

    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

    const actor = { id: session.user.id, role: session.user.role }
    if (!(await canAccessDoc(doc, actor))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json(doc)
  } catch (error) {
    console.error('GET /api/docs/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()
    const { id } = await params
    const body = await req.json()
    const actor = { id: session.user.id, role: session.user.role }

    const existing = await Doc.findById(id)
    if (!existing) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

    if (!(await canAccessDoc(existing, actor))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const updates = pickAllowedFields(body, DOC_PATCH_FIELDS)

    if (updates.projectId && typeof updates.projectId === 'string') {
      const project = await findAccessibleProject(updates.projectId, actor)
      if (!project) {
        return NextResponse.json({ error: 'Cannot attach document to an inaccessible project' }, { status: 403 })
      }
    }

    const doc = await Doc.findByIdAndUpdate(id, updates, { new: true })
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

    await ActivityLog.create({
      actorId: session.user.id,
      action: 'updated_document',
      entityType: 'document',
      entityId: doc._id,
      entityTitle: doc.title,
    })

    return NextResponse.json(doc)
  } catch (error) {
    console.error('PATCH /api/docs/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()
    const { id } = await params
    const actor = { id: session.user.id, role: session.user.role }

    const doc = await Doc.findById(id)
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

    if (!(await canAccessDoc(doc, actor))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Author or admin may delete
    const authorId = doc.authorId?.toString?.() || String(doc.authorId || '')
    if (authorId !== session.user.id && session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Only the author or an admin can delete this document' }, { status: 403 })
    }

    await Doc.findByIdAndDelete(id)

    await ActivityLog.create({
      actorId: session.user.id,
      action: 'deleted_document',
      entityType: 'document',
      entityId: doc._id,
      entityTitle: doc.title,
    })

    return NextResponse.json({ message: 'Document deleted' })
  } catch (error) {
    console.error('DELETE /api/docs/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
