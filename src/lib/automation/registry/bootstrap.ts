import { registerJobHandler, listRegisteredJobTypes } from '@/lib/automation/registry/handlers'
import { workflowExecutionResumeHandler } from '@/lib/automation/handlers/workflowResume'
import {
  aiDocumentSummarizeHandler,
  aiTasksGenerateHandler,
} from '@/lib/automation/handlers/aiJobs'
import { governanceExportRunHandler } from '@/lib/automation/handlers/governanceExport'

let bootstrapped = false

/** Idempotent handler registration for worker + API processes. */
export function ensureAutomationHandlersRegistered(): string[] {
  if (!bootstrapped) {
    registerJobHandler('workflow.execution.resume', workflowExecutionResumeHandler)
    registerJobHandler('ai.document.summarize', aiDocumentSummarizeHandler)
    registerJobHandler('ai.tasks.generate', aiTasksGenerateHandler)
    registerJobHandler('governance.export.run', governanceExportRunHandler)
    bootstrapped = true
  }
  return listRegisteredJobTypes()
}
