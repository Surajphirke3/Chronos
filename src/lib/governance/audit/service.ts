import { createHash, randomUUID } from 'crypto'
import { connectDB } from '@/lib/mongodb/client'
import { AuditEvent } from '@/lib/mongodb/models/AuditEvent'
import { AppError } from '@/lib/api/errors'
import { isGovernanceAuditLogsEnabled } from '@/lib/governance/flags'
import { redactValue } from './redact'

export type AuditWriteInput = {
  organizationId: string
  workspaceId?: string | null
  actorUserId?: string | null
  actorType?: 'user' | 'api_key' | 'system' | 'worker' | 'platform'
  actorApiKeyId?: string | null
  action: string
  resourceType: string
  resourceId?: string | null
  outcome?: 'success' | 'failure' | 'denied'
  correlationId?: string
  requestId?: string
  ip?: string | null
  userAgent?: string | null
  before?: unknown
  after?: unknown
  metadata?: Record<string, unknown>
  source?: 'web' | 'api' | 'worker' | 'system' | 'platform'
}

function hashIp(ip?: string | null): string {
  if (!ip) return ''
  return createHash('sha256').update(ip).digest('hex').slice(0, 32)
}

async function persist(input: AuditWriteInput) {
  await connectDB()
  return AuditEvent.create({
    organizationId: input.organizationId,
    workspaceId: input.workspaceId || null,
    actorUserId: input.actorUserId || null,
    actorType: input.actorType || 'user',
    actorApiKeyId: input.actorApiKeyId || null,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId || null,
    outcome: input.outcome || 'success',
    correlationId: input.correlationId || randomUUID(),
    requestId: input.requestId || '',
    ipHash: hashIp(input.ip),
    userAgent: (input.userAgent || '').slice(0, 200),
    before: input.before == null ? null : redactValue(input.before),
    after: input.after == null ? null : redactValue(input.after),
    metadata: redactValue(input.metadata || {}) as Record<string, unknown>,
    source: input.source || 'web',
    schemaVersion: 1,
  })
}

/**
 * Security-critical audit: fails closed if persistence fails when audit flag is on.
 * When flag is off, still attempts write for critical ops but does not fail closed
 * (staging rollout); document as fail-open until GOVERNANCE_AUDIT_LOGS_ENABLED.
 */
export async function writeCriticalAudit(input: AuditWriteInput): Promise<void> {
  try {
    await persist(input)
  } catch (e) {
    if (isGovernanceAuditLogsEnabled()) {
      throw new AppError('Audit recording failed; operation aborted', 500)
    }
    console.error('[audit] critical write failed (flag off — fail-open)', e)
  }
}

/** Best-effort product/governance audit — never blocks the primary mutation. */
export async function writeBestEffortAudit(input: AuditWriteInput): Promise<void> {
  try {
    await persist(input)
  } catch (e) {
    console.error('[audit] best-effort write failed', e)
  }
}

export async function listAuditEvents(params: {
  organizationId: string
  action?: string
  actorUserId?: string
  resourceType?: string
  workspaceId?: string
  outcome?: string
  limit?: number
  before?: Date
}) {
  await connectDB()
  const filter: Record<string, unknown> = { organizationId: params.organizationId }
  if (params.action) filter.action = params.action
  if (params.actorUserId) filter.actorUserId = params.actorUserId
  if (params.resourceType) filter.resourceType = params.resourceType
  if (params.workspaceId) filter.workspaceId = params.workspaceId
  if (params.outcome) filter.outcome = params.outcome
  if (params.before) filter.createdAt = { $lt: params.before }

  const limit = Math.min(Math.max(params.limit || 50, 1), 100)
  return AuditEvent.find(filter).sort({ createdAt: -1 }).limit(limit).lean()
}
