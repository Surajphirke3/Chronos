import { connectDB } from '@/lib/mongodb/client'
import { Project } from '@/lib/mongodb/models/Project'
import { ActivityLog } from '@/lib/mongodb/models/ActivityLog'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { projectVisibilityFilter } from '@/lib/auth/access'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()
    const filter = projectVisibilityFilter({
      id: session.user.id,
      role: session.user.role,
    })

    const projects = await Project.find(filter)
      .populate('ownerId', 'name avatarUrl')
      .populate('members', 'name avatarUrl')
      .sort({ updatedAt: -1 })

    return NextResponse.json(projects)
  } catch (error) {
    console.error('GET /api/projects error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
      ownerId: session.user.id,
      members: Array.from(new Set([session.user.id, ...memberIds])),
    })

    await ActivityLog.create({
      actorId: session.user.id,
      action: 'created_project',
      entityType: 'project',
      entityId: project._id,
      entityTitle: project.name,
    })

    return NextResponse.json(project, { status: 201 })
  } catch (error) {
    console.error('POST /api/projects error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
