import { connectDB } from '@/lib/mongodb/client'
import { Workflow } from '@/lib/mongodb/models/Workflow'
import { Lead } from '@/lib/mongodb/models/Lead'
import { WorkflowExecution } from '@/lib/mongodb/models/WorkflowExecution'
import { executeStep } from '@/lib/engine/WorkflowEngine'
import { NextResponse } from 'next/server'
import { checkRateLimit, RATE_LIMITS } from '@/lib/security/rateLimit'
import { getActiveTenantContext, workspaceScopedFilter } from '@/lib/tenancy/context'
import { isMultiTenantEnforced } from '@/lib/tenancy/flags'
import { mergeMongoFilters, tenantErrorResponse } from '@/lib/tenancy/http'
import { getAutomationConfig } from '@/lib/automation/config'
import { enqueueJob } from '@/lib/automation/queue/enqueue'
import { newCorrelationId } from '@/lib/automation/observability'
import { AppError } from '@/lib/api/errors'

/**
 * Execute a workflow against leads.
 *
 * Default (AUTOMATION_ASYNC_EXECUTE=true): create executions + enqueue durable jobs (202).
 * Sync fallback when flag is false: prior in-request step loop (legacy).
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getActiveTenantContext({ requireWorkspace: isMultiTenantEnforced() })
    if (!ctx.organizationId || !ctx.workspaceId) {
      // Async path requires tenant IDs; sync legacy may continue without enforce
      if (getAutomationConfig().asyncExecute && isMultiTenantEnforced()) {
        throw new AppError('Active workspace required', 403)
      }
    }

    const rate = await checkRateLimit(
      `wf-exec:${ctx.userId}`,
      RATE_LIMITS.workflowExecute.limit,
      RATE_LIMITS.workflowExecute.windowMs
    )
    if (!rate.allowed) {
      return NextResponse.json({ error: 'Workflow execution rate limit exceeded' }, { status: 429 })
    }

    const { id } = await params
    await connectDB()

    const workflow = await Workflow.findOne(
      mergeMongoFilters(workspaceScopedFilter(ctx), {
        _id: id,
        ...(ctx.workspaceId ? {} : { ownerId: ctx.userId }),
      })
    )
    if (!workflow) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    if (!workflow.nodes || workflow.nodes.length === 0) {
      return NextResponse.json({ error: 'Workflow has no nodes' }, { status: 400 })
    }

    const body = await req.json().catch(() => ({}))
    const { leadIds, status: filterStatus, limit: maxLeads, sync } = body
    const asyncMode = getAutomationConfig().asyncExecute && sync !== true

    let leads: any[]
    const leadScope = mergeMongoFilters(workspaceScopedFilter(ctx), {
      ...(ctx.workspaceId ? {} : { ownerId: ctx.userId }),
    })

    if (leadIds && Array.isArray(leadIds) && leadIds.length > 0) {
      leads = await Lead.find(mergeMongoFilters(leadScope, { _id: { $in: leadIds } }))
    } else {
      leads = await Lead.find(
        mergeMongoFilters(leadScope, { status: filterStatus || 'new' })
      ).limit(maxLeads || 50)
    }

    if (leads.length === 0) {
      return NextResponse.json(
        {
          error:
            'No leads found. Import leads from CSV/Excel first in the Leads page, then come back and execute.',
        },
        { status: 400 }
      )
    }

    const correlationId = newCorrelationId()
    const workflowVersion = workflow.version || 1
    const definitionSnapshot = {
      nodes: workflow.nodes,
      edges: workflow.edges,
      config: {
        ...((workflow.config as Record<string, unknown>) || {}),
        aiApiKey: undefined,
        smtpPass: undefined,
      },
      version: workflowVersion,
    }

    if (!ctx.organizationId || !ctx.workspaceId) {
      // Cannot durable-enqueue without tenant; force sync for this request
      return await runSyncExecute({
        ctx,
        workflow,
        leads,
        correlationId,
        workflowVersion,
        definitionSnapshot,
      })
    }

    const executions = await WorkflowExecution.insertMany(
      leads.map((lead: any) => ({
        workflowId: workflow._id,
        leadId: lead._id,
        ownerId: ctx.userId,
        organizationId: ctx.organizationId,
        workspaceId: ctx.workspaceId,
        status: 'pending',
        currentNodeId: null,
        nextExecutionAt: new Date(),
        workflowVersion,
        definitionSnapshot,
        correlationId,
      }))
    )

    await Lead.updateMany(
      { _id: { $in: leads.map((l: any) => l._id) } },
      { $set: { status: 'in_sequence' } }
    )

    workflow.status = 'active'
    await workflow.save()

    if (!asyncMode) {
      return await runSyncFromExecutions({ executions, leads })
    }

    const jobIds: string[] = []
    for (const exec of executions) {
      const { job } = await enqueueJob({
        organizationId: ctx.organizationId,
        workspaceId: ctx.workspaceId,
        initiatedBy: ctx.userId,
        jobType: 'workflow.execution.resume',
        payload: { executionId: String(exec._id), workflowId: String(workflow._id) },
        idempotencyKey: `wf-exec-resume:${String(exec._id)}:v1`,
        correlationId,
        priority: 10,
      })
      jobIds.push(String((job as { _id: unknown })._id))
    }

    return NextResponse.json(
      {
        message: `Queued workflow for ${leads.length} lead${leads.length !== 1 ? 's' : ''}`,
        total: leads.length,
        mode: 'async',
        correlationId,
        executionIds: executions.map((e: { _id: unknown }) => String(e._id)),
        jobIds,
        engine: 'automation',
      },
      { status: 202 }
    )
  } catch (error: any) {
    return tenantErrorResponse(error, error?.message || 'Failed to execute workflow')
  }
}

async function runSyncExecute(params: {
  ctx: { userId: string; organizationId: string | null; workspaceId: string | null }
  workflow: any
  leads: any[]
  correlationId: string
  workflowVersion: number
  definitionSnapshot: Record<string, unknown>
}) {
  const executions = await WorkflowExecution.insertMany(
    params.leads.map((lead: any) => ({
      workflowId: params.workflow._id,
      leadId: lead._id,
      ownerId: params.ctx.userId,
      organizationId: params.ctx.organizationId || undefined,
      workspaceId: params.ctx.workspaceId || undefined,
      status: 'pending',
      currentNodeId: null,
      workflowVersion: params.workflowVersion,
      definitionSnapshot: params.definitionSnapshot,
      correlationId: params.correlationId,
    }))
  )
  await Lead.updateMany(
    { _id: { $in: params.leads.map((l: any) => l._id) } },
    { $set: { status: 'in_sequence' } }
  )
  params.workflow.status = 'active'
  await params.workflow.save()
  return runSyncFromExecutions({ executions, leads: params.leads })
}

async function runSyncFromExecutions(params: { executions: any[]; leads: any[] }) {
  const results: { leadName: string; status: string; error?: string }[] = []
  for (let i = 0; i < params.executions.length; i++) {
    const exec = params.executions[i]
    if (i > 0 && params.executions.length > 1) {
      await new Promise((resolve) => setTimeout(resolve, 3000 + Math.floor(Math.random() * 5000)))
    }
    try {
      await executeStep(exec._id.toString())
      const updated = (await WorkflowExecution.findById(exec._id).lean()) as any
      const lead = params.leads.find((l: any) => l._id.toString() === exec.leadId.toString())
      results.push({
        leadName: lead ? `${lead.firstName} ${lead.lastName}` : 'Unknown',
        status: updated?.status || 'completed',
        error: updated?.errorMessage,
      })
    } catch (err: any) {
      results.push({ leadName: 'Unknown', status: 'failed', error: err.message })
    }
  }
  const succeeded = results.filter((r) => r.status === 'completed').length
  const failed = results.filter((r) => r.status === 'failed').length
  return NextResponse.json({
    message: `Workflow executed for ${params.leads.length} lead${params.leads.length !== 1 ? 's' : ''} — ${succeeded} succeeded, ${failed} failed`,
    total: params.leads.length,
    succeeded,
    failed,
    results,
    mode: 'sync',
    engine: 'local',
  })
}
