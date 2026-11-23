import { Types } from 'mongoose'
import { connectDB } from '@/lib/mongodb/client'
import { WorkflowExecution } from '@/lib/mongodb/models/WorkflowExecution'
import { Workspace } from '@/lib/mongodb/models/Workspace'
import { executeStep } from '@/lib/engine/WorkflowEngine'
import type { JobHandler } from '@/lib/automation/registry/handlers'
import { AutomationError } from '@/lib/automation/types'
import { enqueueJob } from '@/lib/automation/queue/enqueue'

/**
 * Resumes a single WorkflowExecution step under immutable job tenant context.
 * Does not use HTTP session state.
 * If the engine pauses (delay), schedules a follow-up resume job at nextExecutionAt.
 */
export const workflowExecutionResumeHandler: JobHandler = async (ctx, payload) => {
  const executionId = String(payload.executionId || '')
  if (!Types.ObjectId.isValid(executionId)) {
    throw new AutomationError('executionId is required', 'permanent')
  }

  await connectDB()

  const workspace = await Workspace.findOne({
    _id: ctx.workspaceId,
    organizationId: ctx.organizationId,
    status: 'active',
  })
    .select('_id')
    .lean()
  if (!workspace) {
    throw new AutomationError('Workspace inactive or not found for job context', 'permanent')
  }

  const execution = await WorkflowExecution.findOne({
    _id: executionId,
    $or: [
      { workspaceId: ctx.workspaceId },
      { workspaceId: { $exists: false }, ownerId: ctx.initiatedBy },
      { workspaceId: null, ownerId: ctx.initiatedBy },
    ],
  })

  if (!execution) {
    throw new AutomationError('Workflow execution not found in tenant scope', 'permanent')
  }

  if (['completed', 'failed', 'opted_out'].includes(execution.status)) {
    return { result: { skipped: true, status: execution.status } }
  }

  await executeStep(executionId)

  const after = await WorkflowExecution.findById(executionId)
    .select('status nextExecutionAt')
    .lean()

  // executeStep recursively advances until delay/end/fail; only delays need a follow-up job
  if (after?.status === 'paused' && after.nextExecutionAt) {
    const availableAt = new Date(after.nextExecutionAt)
    await enqueueJob({
      organizationId: ctx.organizationId,
      workspaceId: ctx.workspaceId,
      initiatedBy: ctx.initiatedBy,
      jobType: 'workflow.execution.resume',
      payload: { executionId, workflowId: payload.workflowId },
      idempotencyKey: `wf-exec-resume:${executionId}:${availableAt.toISOString()}`,
      correlationId: ctx.correlationId,
      availableAt,
      priority: 5,
    })
  }

  return { result: { status: after?.status || 'unknown' } }
}
