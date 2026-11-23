import { connectDB } from '@/lib/mongodb/client'
import { Workflow } from '@/lib/mongodb/models/Workflow'
import { NextResponse } from 'next/server'
import { redactWorkflowConfigSecrets } from '@/lib/security/secrets'
import { getActiveTenantContext, workspaceScopedFilter } from '@/lib/tenancy/context'
import { isMultiTenantEnforced } from '@/lib/tenancy/flags'
import { mergeMongoFilters, tenantErrorResponse } from '@/lib/tenancy/http'
import { workspaceRoleAtLeast } from '@/lib/tenancy/roles'

export async function GET() {
  try {
    const ctx = await getActiveTenantContext({ requireWorkspace: isMultiTenantEnforced() })
    await connectDB()

    const filter = mergeMongoFilters(workspaceScopedFilter(ctx), {
      ...(ctx.workspaceId ? {} : { ownerId: ctx.userId }),
    })

    const workflows = await Workflow.find(filter).sort({ updatedAt: -1 }).lean()

    const sanitized = workflows.map((workflow: Record<string, unknown>) => ({
      ...workflow,
      config: redactWorkflowConfigSecrets(
        (workflow.config as Record<string, unknown>) || undefined
      ),
    }))

    return NextResponse.json({ workflows: sanitized })
  } catch (error) {
    return tenantErrorResponse(error, 'Failed to fetch workflows')
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await getActiveTenantContext({ requireWorkspace: isMultiTenantEnforced() })
    if (ctx.workspaceRole && !workspaceRoleAtLeast(ctx.workspaceRole, 'member')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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
      ownerId: ctx.userId,
      organizationId: ctx.organizationId || undefined,
      workspaceId: ctx.workspaceId || undefined,
      nodes: nodes || [],
      edges: edges || [],
      status: 'draft',
    })

    return NextResponse.json({ workflow }, { status: 201 })
  } catch (error) {
    return tenantErrorResponse(error, 'Failed to create workflow')
  }
}
