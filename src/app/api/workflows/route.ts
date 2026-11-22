import { connectDB } from '@/lib/mongodb/client'
import { Workflow } from '@/lib/mongodb/models/Workflow'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { redactWorkflowConfigSecrets } from '@/lib/security/secrets'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const workflows = await Workflow.find({ ownerId: session.user.id })
      .sort({ updatedAt: -1 })
      .lean()

    const sanitized = workflows.map((workflow: Record<string, unknown>) => ({
      ...workflow,
      config: redactWorkflowConfigSecrets(
        (workflow.config as Record<string, unknown>) || undefined
      ),
    }))

    return NextResponse.json({ workflows: sanitized })
  } catch (error) {
    console.error('Error fetching workflows')
    return NextResponse.json({ error: 'Failed to fetch workflows' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { name, description, nodes, edges } = body

    if (!name) {
      return NextResponse.json({ error: 'Workflow name is required' }, { status: 400 })
    }

    await connectDB()

    const workflow = await Workflow.create({
      name,
      description: description || '',
      ownerId: session.user.id,
      nodes: nodes || [],
      edges: edges || [],
      status: 'draft',
    })

    return NextResponse.json({ workflow }, { status: 201 })
  } catch (error) {
    console.error('Error creating workflow:', error)
    return NextResponse.json({ error: 'Failed to create workflow' }, { status: 500 })
  }
}
