import { connectDB } from '@/lib/mongodb/client'
import { ActivityLog } from '@/lib/mongodb/models/ActivityLog'
import { Project } from '@/lib/mongodb/models/Project'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { NextResponse } from 'next/server'
import { projectVisibilityFilter } from '@/lib/auth/access'
import { paginationSchema, parseWithSchema } from '@/lib/api/validation'

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()
    const { searchParams } = new URL(req.url)
    const parsed = parseWithSchema(paginationSchema, {
      limit: searchParams.get('limit') || 20,
    })
    if (parsed.ok === false) return parsed.response

    const actor = { id: session.user.id, role: session.user.role }

    let filter: Record<string, unknown> = {}
    if (actor.role !== 'admin') {
      const accessibleProjects = await Project.find(projectVisibilityFilter(actor)).select('_id')
      const projectIds = accessibleProjects.map((p: { _id: unknown }) => p._id)
      filter = {
        $or: [
          { actorId: session.user.id },
          { entityType: 'project', entityId: { $in: projectIds } },
        ],
      }
    }

    const logs = await ActivityLog.find(filter)
      .populate('actorId', 'name avatarUrl')
      .sort({ createdAt: -1, _id: -1 })
      .limit(parsed.data.limit)

    // Preserve array response shape for existing dashboard consumers
    if (searchParams.get('meta') === '1') {
      return NextResponse.json({
        logs,
        pagination: {
          limit: parsed.data.limit,
          hasMore: logs.length === parsed.data.limit,
        },
      })
    }

    return NextResponse.json(logs)
  } catch (error) {
    console.error('GET /api/activity error')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
