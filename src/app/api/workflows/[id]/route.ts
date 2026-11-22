import { connectDB } from '@/lib/mongodb/client'
import { Workflow } from '@/lib/mongodb/models/Workflow'
import { NextResponse } from 'next/server'
import { pickAllowedFields, WORKFLOW_PATCH_FIELDS } from '@/lib/auth/access'
import {
  encryptWorkflowConfigSecrets,
  redactWorkflowConfigSecrets,
  SecretEncryptionError,
} from '@/lib/security/secrets'
import { getActiveTenantContext, workspaceScopedFilter } from '@/lib/tenancy/context'
import { isMultiTenantEnforced } from '@/lib/tenancy/flags'
import {
  assertResourceInWorkspace,
  mergeMongoFilters,
  tenantErrorResponse,
} from '@/lib/tenancy/http'

function presentWorkflow(workflow: Record<string, unknown>) {
  const config = redactWorkflowConfigSecrets(
    (workflow.config as Record<string, unknown>) || undefined
  )
  return { ...workflow, config }
}

function ownershipFilter(ctx: { userId: string; workspaceId: string | null }) {
  return mergeMongoFilters(workspaceScopedFilter(ctx as any), {
    ...(ctx.workspaceId ? {} : { ownerId: ctx.userId }),
  })
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getActiveTenantContext({ requireWorkspace: isMultiTenantEnforced() })
    const { id } = await params
    await connectDB()

    const workflow = (await Workflow.findOne(
      mergeMongoFilters({ _id: id }, ownershipFilter(ctx))
    ).lean()) as Record<string, unknown> | null

    if (!workflow || !assertResourceInWorkspace(workflow, ctx.workspaceId, !isMultiTenantEnforced())) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({ workflow: presentWorkflow(workflow) })
  } catch (error) {
    return tenantErrorResponse(error, 'Failed to fetch workflow')
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getActiveTenantContext({ requireWorkspace: isMultiTenantEnforced() })
    const { id } = await params
    const body = await req.json()
    const updates = pickAllowedFields(body, WORKFLOW_PATCH_FIELDS) as Record<string, unknown>

    if (updates.config && typeof updates.config === 'object') {
      updates.config = encryptWorkflowConfigSecrets(updates.config as Record<string, unknown>)
    }

    await connectDB()

    const workflow = (await Workflow.findOneAndUpdate(
      mergeMongoFilters({ _id: id }, ownershipFilter(ctx)),
      { $set: updates },
      { new: true }
    ).lean()) as Record<string, unknown> | null

    if (!workflow) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({ workflow: presentWorkflow(workflow) })
  } catch (error) {
    if (error instanceof SecretEncryptionError) {
      return NextResponse.json(
        { error: 'Secret encryption is not configured on the server' },
        { status: 503 }
      )
    }
    return tenantErrorResponse(error, 'Failed to update workflow')
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getActiveTenantContext({ requireWorkspace: isMultiTenantEnforced() })
    const { id } = await params
    await connectDB()

    await Workflow.deleteOne(mergeMongoFilters({ _id: id }, ownershipFilter(ctx)))

    return NextResponse.json({ success: true })
  } catch (error) {
    return tenantErrorResponse(error, 'Failed to delete workflow')
  }
}
