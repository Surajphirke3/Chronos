import { connectDB } from '@/lib/mongodb/client'
import { Project } from '@/lib/mongodb/models/Project'
import { Task } from '@/lib/mongodb/models/Task'
import { ActivityLog } from '@/lib/mongodb/models/ActivityLog'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import {
  canAccessProject,
  pickAllowedFields,
  PROJECT_PATCH_FIELDS,
} from '@/lib/auth/access'
import { NextResponse } from 'next/server'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()
    const { id } = await params
    const project = await Project.findById(id)
      .populate('ownerId', 'name avatarUrl email')
      .populate('members', 'name avatarUrl email title')

    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    if (!canAccessProject(project, { id: session.user.id, role: session.user.role })) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const taskStats = await Task.aggregate([
      { $match: { projectId: project._id } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ])

    return NextResponse.json({ ...project.toObject(), taskStats })
  } catch (error) {
    console.error('GET /api/projects/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()
    const { id } = await params
    const existing = await Project.findById(id)
    if (!existing) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    const actor = { id: session.user.id, role: session.user.role }
    if (!canAccessProject(existing, actor)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Only owner or admin may mutate project metadata / membership
    const ownerId = existing.ownerId?.toString?.() || String(existing.ownerId)
    if (ownerId !== session.user.id && session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Only the project owner or an admin can update this project' }, { status: 403 })
    }

    const body = await req.json()
    const updates = pickAllowedFields(body, PROJECT_PATCH_FIELDS)

    const project = await Project.findByIdAndUpdate(id, updates, { new: true })
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    await ActivityLog.create({
      actorId: session.user.id,
      action: 'updated_project',
      entityType: 'project',
      entityId: project._id,
      entityTitle: project.name,
    })

    return NextResponse.json(project)
  } catch (error) {
    console.error('PATCH /api/projects/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()
    const { id } = await params

    const project = await Project.findById(id)
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    if (project.ownerId.toString() !== session.user.id && session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Not authorized to delete this project' }, { status: 403 })
    }

    await Task.deleteMany({ projectId: id })
    await Project.findByIdAndDelete(id)

    await ActivityLog.create({
      actorId: session.user.id,
      action: 'deleted_project',
      entityType: 'project',
      entityId: project._id,
      entityTitle: project.name,
    })

    return NextResponse.json({ message: 'Project deleted' })
  } catch (error) {
    console.error('DELETE /api/projects/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
