export const JOB_STATUSES = [
  'queued',
  'scheduled',
  'processing',
  'retrying',
  'completed',
  'failed',
  'cancelled',
  'dead_letter',
] as const

export type JobStatus = (typeof JOB_STATUSES)[number]

export const JOB_TYPES = [
  'workflow.execution.resume',
  'ai.document.summarize',
  'ai.tasks.generate',
  'automation.schedule.tick',
  'governance.export.run',
] as const

export type JobType = (typeof JOB_TYPES)[number] | string

export type JobExecutionContext = {
  organizationId: string
  workspaceId: string
  initiatedBy: string
  jobId: string
  correlationId: string
  idempotencyKey: string
  payloadVersion: number
  workerId: string
  attempt: number
  traceId: string
  executionDeadline: Date
}

export type JobHandlerResult = {
  result?: Record<string, unknown>
}

export type ErrorClass = 'transient' | 'permanent'

export class AutomationError extends Error {
  classification: ErrorClass
  constructor(message: string, classification: ErrorClass = 'permanent') {
    super(message)
    this.name = 'AutomationError'
    this.classification = classification
  }
}
