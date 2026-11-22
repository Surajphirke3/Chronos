import { connectDB } from '@/lib/mongodb/client'
import { Doc } from '@/lib/mongodb/models/Document'
import { Project } from '@/lib/mongodb/models/Project'
import { ActivityLog } from '@/lib/mongodb/models/ActivityLog'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { findAccessibleProject, projectVisibilityFilter } from '@/lib/auth/access'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()
    const actor = { id: session.user.id, role: session.user.role }
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search')
    const type = searchParams.get('type')

    const accessibleProjects = await Project.find(projectVisibilityFilter(actor)).select('_id')
    const projectIds = accessibleProjects.map((p: { _id: { toString: () => string } }) => p._id)

    // Author's own docs, or docs linked to accessible projects
    const filter: Record<string, unknown> = {
      $or: [
        { authorId: session.user.id },
        { projectId: { $in: projectIds } },
      ],
    }
    if (actor.role === 'admin') {
      delete filter.$or
    }
    if (type) filter.type = type
    if (search) filter.$text = { $search: search }

    const docs = await Doc.find(filter)
      .populate('authorId', 'name avatarUrl')
      .populate('projectId', 'name color')
      .sort({ isPinned: -1, updatedAt: -1 })

    return NextResponse.json(docs)
  } catch (error) {
    console.error('GET /api/docs error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()
    const body = await req.json()
    const actor = { id: session.user.id, role: session.user.role }

    const title = typeof body.title === 'string' ? body.title.trim() : ''
    if (!title) {
      return NextResponse.json({ error: 'Document title is required' }, { status: 400 })
    }

    if (body.projectId) {
      const project = await findAccessibleProject(String(body.projectId), actor)
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
      authorId: session.user.id,
    })

    await ActivityLog.create({
      actorId: session.user.id,
      action: 'created_document',
      entityType: 'document',
      entityId: doc._id,
      entityTitle: doc.title,
    })

    return NextResponse.json(doc, { status: 201 })
  } catch (error) {
    console.error('POST /api/docs error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
