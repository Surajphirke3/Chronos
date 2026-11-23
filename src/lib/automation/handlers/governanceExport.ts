import type { JobExecutionContext, JobHandlerResult } from '@/lib/automation/types'
import { processExportRequest } from '@/lib/governance/data/exportService'
import { AutomationError } from '@/lib/automation/types'

export async function governanceExportRunHandler(
  ctx: JobExecutionContext,
  payload: Record<string, unknown>
): Promise<JobHandlerResult> {
  const exportRequestId = String(payload.exportRequestId || '')
  if (!exportRequestId) {
    throw new AutomationError('exportRequestId required', 'permanent')
  }
  // Tenant identity comes from the job record, not browser session.
  if (!ctx.organizationId) {
    throw new AutomationError('Missing organization context', 'permanent')
  }
  await processExportRequest(exportRequestId)
  return { result: { exportRequestId, status: 'completed' } }
}
