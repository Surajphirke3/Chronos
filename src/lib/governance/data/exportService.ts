import { createHash, randomBytes, randomUUID } from 'crypto'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { connectDB } from '@/lib/mongodb/client'
import { DataExportRequest } from '@/lib/mongodb/models/DataExportRequest'
import { Organization } from '@/lib/mongodb/models/Organization'
import { Membership } from '@/lib/mongodb/models/Membership'
import { Workspace } from '@/lib/mongodb/models/Workspace'
import { AppError } from '@/lib/api/errors'
import { isGovernanceDataExportEnabled } from '@/lib/governance/flags'
import { hasPermission, type PermissionActor } from '@/lib/governance/permissions'
import {
  assertDataExportAllowed,
  getOrCreateSecurityPolicy,
} from '@/lib/governance/security/policy'
import { writeCriticalAudit } from '@/lib/governance/audit/service'
import { enqueueJob } from '@/lib/automation/queue/enqueue'

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export async function requestDataExport(params: {
  organizationId: string
  workspaceId?: string | null
  actor: PermissionActor
  scope: 'organization' | 'workspace'
}) {
  if (!isGovernanceDataExportEnabled()) throw new AppError('Data export is disabled', 403)
  if (!hasPermission(params.actor, 'data.export', {
    resourceOrganizationId: params.organizationId,
  })) {
    throw new AppError('Forbidden', 403)
  }

  const policy = await getOrCreateSecurityPolicy(params.organizationId)
  assertDataExportAllowed(policy)

  if (params.scope === 'workspace' && !params.workspaceId) {
    throw new AppError('workspaceId required for workspace export', 400)
  }

  await connectDB()
  const correlationId = randomUUID()
  const req = await DataExportRequest.create({
    organizationId: params.organizationId,
    workspaceId: params.workspaceId || null,
    requestedBy: params.actor.userId,
    status: 'queued',
    scope: params.scope,
    correlationId,
  })

  // Prefer durable job when workspace context available; otherwise process inline fallback.
  let jobId: string | null = null
  if (params.workspaceId) {
    try {
      const enqueued = await enqueueJob({
        organizationId: params.organizationId,
        workspaceId: params.workspaceId,
        initiatedBy: params.actor.userId,
        jobType: 'governance.export.run',
        payload: { exportRequestId: String(req._id) },
        correlationId,
        idempotencyKey: `export:${req._id}`,
      })
      const createdJobId = String(enqueued.job._id || '')
      if (createdJobId) {
        jobId = createdJobId
        req.jobId = createdJobId
        await req.save()
      }
    } catch {
      // Fall through to sync processing for environments without worker
    }
  }

  if (!jobId) {
    await processExportRequest(String(req._id))
  }

  await writeCriticalAudit({
    organizationId: params.organizationId,
    workspaceId: params.workspaceId,
    actorUserId: params.actor.userId,
    action: 'data.export_requested',
    resourceType: 'DataExportRequest',
    resourceId: String(req._id),
    correlationId,
    source: 'api',
  })

  return DataExportRequest.findById(req._id).lean()
}

export async function processExportRequest(exportRequestId: string) {
  await connectDB()
  const req = await DataExportRequest.findById(exportRequestId)
  if (!req) return
  if (req.status === 'completed') return

  req.status = 'processing'
  await req.save()

  try {
    const org = await Organization.findById(req.organizationId).lean()
    const members = await Membership.find({
      organizationId: req.organizationId,
      status: 'active',
    })
      .select('userId role status')
      .lean()
    const workspaces = await Workspace.find({
      organizationId: req.organizationId,
      status: 'active',
    })
      .select('name slug status')
      .lean()

    const payload = {
      exportedAt: new Date().toISOString(),
      organization: org
        ? { _id: org._id, name: org.name, slug: org.slug, status: org.status }
        : null,
      members,
      workspaces,
      note: 'Audit events are not included in standard project cleanup exports.',
    }

    const dir = path.join(process.cwd(), '.data', 'exports', String(req.organizationId))
    await mkdir(dir, { recursive: true })
    const file = path.join(dir, `${req._id}.json`)
    await writeFile(file, JSON.stringify(payload, null, 2), 'utf8')

    const downloadToken = randomBytes(24).toString('base64url')
    req.artifactPath = file
    req.downloadTokenHash = hashToken(downloadToken)
    req.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
    req.status = 'completed'
    req.error = ''
    await req.save()

    // Stash one-time token on the in-memory return via metadata field abuse avoided —
    // caller of sync path reads from process return below.
    return { downloadToken, expiresAt: req.expiresAt }
  } catch (e) {
    req.status = 'failed'
    req.error = e instanceof Error ? e.message : 'Export failed'
    await req.save()
    throw e
  }
}

export async function authorizeExportDownload(params: {
  organizationId: string
  exportRequestId: string
  token: string
  actor: PermissionActor
}) {
  if (!hasPermission(params.actor, 'data.export', {
    resourceOrganizationId: params.organizationId,
  })) {
    throw new AppError('Forbidden', 403)
  }
  await connectDB()
  const req = await DataExportRequest.findOne({
    _id: params.exportRequestId,
    organizationId: params.organizationId,
  })
  if (!req || req.status !== 'completed') throw new AppError('Not found', 404)
  if (!req.expiresAt || req.expiresAt < new Date()) {
    req.status = 'expired'
    await req.save()
    throw new AppError('Export expired', 410)
  }
  if (req.downloadTokenHash !== hashToken(params.token)) {
    throw new AppError('Invalid download token', 403)
  }
  return req
}
