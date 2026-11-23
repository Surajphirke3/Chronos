import { connectDB } from '@/lib/mongodb/client'
import { ApiKey } from '@/lib/mongodb/models/ApiKey'
import { AppError } from '@/lib/api/errors'
import { isGovernanceApiKeysEnabled } from '@/lib/governance/flags'
import {
  hasPermission,
  isOwnerOnlyPermission,
  isPermission,
  type Permission,
  type PermissionActor,
} from '@/lib/governance/permissions'
import { generateApiKeySecret, hashApiKeySecret, verifyApiKeySecret } from './crypto'
import { writeCriticalAudit } from '@/lib/governance/audit/service'

function sanitizeScopes(scopes: string[], actor: PermissionActor): Permission[] {
  const out: Permission[] = []
  for (const s of scopes) {
    if (!isPermission(s)) throw new AppError(`Invalid scope: ${s}`, 400)
    if (isOwnerOnlyPermission(s)) throw new AppError(`Scope not allowed on API keys: ${s}`, 403)
    if (!hasPermission(actor, s)) {
      throw new AppError(`Cannot grant scope you do not hold: ${s}`, 403)
    }
    out.push(s)
  }
  return [...new Set(out)]
}

export async function createApiKey(params: {
  organizationId: string
  actor: PermissionActor
  name: string
  scopes: string[]
  expiresAt?: Date | null
  workspaceId?: string | null
}) {
  if (!isGovernanceApiKeysEnabled()) throw new AppError('API keys are disabled', 403)
  if (!hasPermission(params.actor, 'api_keys.create', {
    resourceOrganizationId: params.organizationId,
  })) {
    throw new AppError('Forbidden', 403)
  }

  const scopes = sanitizeScopes(params.scopes, params.actor)
  const { raw, prefix, hash } = generateApiKeySecret()
  await connectDB()
  const doc = await ApiKey.create({
    organizationId: params.organizationId,
    workspaceId: params.workspaceId || null,
    name: params.name.trim(),
    keyPrefix: prefix,
    secretHash: hash,
    scopes,
    createdBy: params.actor.userId,
    status: 'active',
    expiresAt: params.expiresAt || null,
  })

  await writeCriticalAudit({
    organizationId: params.organizationId,
    actorUserId: params.actor.userId,
    action: 'api_key.created',
    resourceType: 'ApiKey',
    resourceId: String(doc._id),
    after: { name: params.name, keyPrefix: prefix, scopes },
    source: 'api',
  })

  return {
    apiKey: {
      _id: doc._id,
      name: doc.name,
      keyPrefix: doc.keyPrefix,
      scopes: doc.scopes,
      expiresAt: doc.expiresAt,
      status: doc.status,
      createdAt: doc.createdAt,
    },
    /** Shown once — never stored or returned again. */
    secret: raw,
  }
}

export async function listApiKeys(organizationId: string) {
  await connectDB()
  return ApiKey.find({ organizationId })
    .select('-secretHash')
    .sort({ createdAt: -1 })
    .limit(100)
    .lean()
}

export async function revokeApiKey(params: {
  organizationId: string
  apiKeyId: string
  actor: PermissionActor
}) {
  if (!isGovernanceApiKeysEnabled()) throw new AppError('API keys are disabled', 403)
  if (!hasPermission(params.actor, 'api_keys.revoke', {
    resourceOrganizationId: params.organizationId,
  })) {
    throw new AppError('Forbidden', 403)
  }
  await connectDB()
  const doc = await ApiKey.findOne({
    _id: params.apiKeyId,
    organizationId: params.organizationId,
  })
  if (!doc) throw new AppError('Not found', 404)
  if (doc.status === 'revoked') return doc.toObject()
  doc.status = 'revoked'
  doc.revokedAt = new Date()
  doc.revokedBy = params.actor.userId
  await doc.save()
  await writeCriticalAudit({
    organizationId: params.organizationId,
    actorUserId: params.actor.userId,
    action: 'api_key.revoked',
    resourceType: 'ApiKey',
    resourceId: String(doc._id),
    source: 'api',
  })
  return doc.toObject()
}

export type AuthenticatedApiKey = {
  apiKeyId: string
  organizationId: string
  workspaceId: string | null
  scopes: Permission[]
  createdBy: string
}

export async function authenticateBearerApiKey(
  authorizationHeader: string | null
): Promise<AuthenticatedApiKey | null> {
  if (!isGovernanceApiKeysEnabled()) return null
  if (!authorizationHeader?.startsWith('Bearer ')) return null
  const raw = authorizationHeader.slice('Bearer '.length).trim()
  if (!raw.startsWith('chronos_')) return null

  await connectDB()
  const hash = hashApiKeySecret(raw)
  const doc = await ApiKey.findOne({ secretHash: hash, status: 'active' }).lean()
  if (!doc) return null
  if (doc.expiresAt && new Date(doc.expiresAt) < new Date()) return null
  if (!verifyApiKeySecret(raw, doc.secretHash)) return null

  // Throttled last-used update (per hour bucket)
  const bucket = new Date().toISOString().slice(0, 13)
  if (doc.lastUsedBucket !== bucket) {
    await ApiKey.updateOne(
      { _id: doc._id },
      { $set: { lastUsedAt: new Date(), lastUsedBucket: bucket } }
    )
  }

  return {
    apiKeyId: String(doc._id),
    organizationId: String(doc.organizationId),
    workspaceId: doc.workspaceId ? String(doc.workspaceId) : null,
    scopes: (doc.scopes || []).filter((s: string) => isPermission(s)),
    createdBy: String(doc.createdBy),
  }
}
