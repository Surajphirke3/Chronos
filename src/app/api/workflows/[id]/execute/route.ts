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

/**
 * Execute a workflow against REAL leads.
 *
 * Request body:
 *   leadIds?: string[]  — specific lead IDs to enroll (from the lead picker)
 *   status?: string     — if no leadIds, enroll all leads with this status (default: 'new')
 *   limit?: number      — max leads to enroll (default: 50)
 *
 * For each selected lead, the engine runs the workflow nodes in order:
 *   Trigger → AI Message (calls your AI API) → Send Email (via SMTP) → Tag Lead → End
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getActiveTenantContext({ requireWorkspace: isMultiTenantEnforced() })

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
    const { leadIds, status: filterStatus, limit: maxLeads } = body

    // ── Find leads to enroll ──
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
      return NextResponse.json({
        error: 'No leads found. Import leads from CSV/Excel first in the Leads page, then come back and execute.',
      }, { status: 400 })
    }

    // ── Create execution records for each lead ──
    const executions = await WorkflowExecution.insertMany(
      leads.map((lead: any) => ({
        workflowId: workflow._id,
        leadId: lead._id,
        ownerId: ctx.userId,
        organizationId: ctx.organizationId || undefined,
        workspaceId: ctx.workspaceId || undefined,
        status: 'pending',
        currentNodeId: null,
      }))
    )

    // Mark leads as in_sequence
    await Lead.updateMany(
      { _id: { $in: leads.map((l: any) => l._id) } },
      { $set: { status: 'in_sequence' } }
    )

    workflow.status = 'active'
    await workflow.save()

    // ── Execute workflow for each lead with randomized delays ──
    // When sending to multiple leads, add a random delay (3-8s) between each
    // to simulate human-like sending behavior and avoid email provider rate limits
    const results: { leadName: string; status: string; error?: string }[] = []

    for (let i = 0; i < executions.length; i++) {
      const exec = executions[i]

      // Random delay between leads (skip for the first one)
      if (i > 0 && executions.length > 1) {
        const delayMs = 3000 + Math.floor(Math.random() * 5000) // 3-8 seconds
        await new Promise(resolve => setTimeout(resolve, delayMs))
      }

      try {
        await executeStep(exec._id.toString())
        const updated = await WorkflowExecution.findById(exec._id).lean() as any
        const lead = leads.find((l: any) => l._id.toString() === exec.leadId.toString())
        results.push({
          leadName: lead ? `${lead.firstName} ${lead.lastName}` : 'Unknown',
          status: updated?.status || 'completed',
          error: updated?.errorMessage,
        })
      } catch (err: any) {
        results.push({
          leadName: 'Unknown',
          status: 'failed',
          error: err.message,
        })
      }
    }

    const succeeded = results.filter(r => r.status === 'completed').length
    const failed = results.filter(r => r.status === 'failed').length

    return NextResponse.json({
      message: `Workflow executed for ${leads.length} lead${leads.length !== 1 ? 's' : ''} — ${succeeded} succeeded, ${failed} failed`,
      total: leads.length,
      succeeded,
      failed,
      results,
      engine: 'local',
    })
  } catch (error: any) {
    return tenantErrorResponse(error, error?.message || 'Failed to execute workflow')
  }
}
