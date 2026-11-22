import { connectDB } from '@/lib/mongodb/client'
import { ActivityLog } from '@/lib/mongodb/models/ActivityLog'
import { Project } from '@/lib/mongodb/models/Project'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { projectVisibilityFilter } from '@/lib/auth/access'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()
    const { searchParams } = new URL(req.url)
    const rawLimit = parseInt(searchParams.get('limit') || '20', 10)
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 20

    const actor = { id: session.user.id, role: session.user.role }

    let filter: Record<string, unknown> = {}
    if (actor.role !== 'admin') {
      const accessibleProjects = await Project.find(projectVisibilityFilter(actor)).select('_id')
      const projectIds = accessibleProjects.map((p: { _id: unknown }) => p._id)
      // Own actions, or activity tied to accessible projects
      filter = {
        $or: [
          { actorId: session.user.id },
          { entityType: 'project', entityId: { $in: projectIds } },
        ],
      }
    }

    const logs = await ActivityLog.find(filter)
      .populate('actorId', 'name avatarUrl')
      .sort({ createdAt: -1 })
      .limit(limit)

    return NextResponse.json(logs)
  } catch (error) {
    console.error('GET /api/activity error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
