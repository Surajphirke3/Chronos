import { connectDB } from '@/lib/mongodb/client'
import { Workflow } from '@/lib/mongodb/models/Workflow'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { pickAllowedFields, WORKFLOW_PATCH_FIELDS } from '@/lib/auth/access'
import {
  encryptWorkflowConfigSecrets,
  redactWorkflowConfigSecrets,
  SecretEncryptionError,
} from '@/lib/security/secrets'

function presentWorkflow(workflow: Record<string, unknown>) {
  const config = redactWorkflowConfigSecrets(
    (workflow.config as Record<string, unknown>) || undefined
  )
  return { ...workflow, config }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    await connectDB()

    const workflow = await Workflow.findOne({ _id: id, ownerId: session.user.id }).lean() as Record<string, unknown> | null
    if (!workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
    }

    return NextResponse.json({ workflow: presentWorkflow(workflow) })
  } catch (error) {
    console.error('Error fetching workflow')
    return NextResponse.json({ error: 'Failed to fetch workflow' }, { status: 500 })
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()
    const updates = pickAllowedFields(body, WORKFLOW_PATCH_FIELDS) as Record<string, unknown>

    if (updates.config && typeof updates.config === 'object') {
      updates.config = encryptWorkflowConfigSecrets(updates.config as Record<string, unknown>)
    }

    await connectDB()

    const workflow = await Workflow.findOneAndUpdate(
      { _id: id, ownerId: session.user.id },
      { $set: updates },
      { new: true }
    ).lean() as Record<string, unknown> | null

    if (!workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
    }

    return NextResponse.json({ workflow: presentWorkflow(workflow) })
  } catch (error) {
    if (error instanceof SecretEncryptionError) {
      return NextResponse.json(
        { error: 'Secret encryption is not configured on the server' },
        { status: 503 }
      )
    }
    console.error('Error updating workflow')
    return NextResponse.json({ error: 'Failed to update workflow' }, { status: 500 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    await connectDB()

    await Workflow.deleteOne({ _id: id, ownerId: session.user.id })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting workflow')
    return NextResponse.json({ error: 'Failed to delete workflow' }, { status: 500 })
  }
}
