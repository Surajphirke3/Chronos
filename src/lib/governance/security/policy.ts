import { connectDB } from '@/lib/mongodb/client'
import { OrganizationSecurityPolicy } from '@/lib/mongodb/models/OrganizationSecurityPolicy'
import { AppError } from '@/lib/api/errors'
import { isGovernanceSecurityPoliciesEnabled } from '@/lib/governance/flags'
import { hasPermission, type PermissionActor } from '@/lib/governance/permissions'
import { writeCriticalAudit } from '@/lib/governance/audit/service'

export type SecurityPolicyDoc = {
  organizationId: string
  allowedInviteEmailDomains: string[]
  allowGuestAccess: boolean
  whoCanInvite: 'owner' | 'admin' | 'members_with_permission'
  allowApiKeyCreation: boolean
  maxApiKeyLifetimeDays: number
  allowDataExport: boolean
  restrictWorkspaceCreationToAdmins: boolean
  mfa: { status: 'unsupported' }
  version: number
}

const DEFAULTS: Omit<SecurityPolicyDoc, 'organizationId'> = {
  allowedInviteEmailDomains: [],
  allowGuestAccess: true,
  whoCanInvite: 'admin',
  allowApiKeyCreation: false,
  maxApiKeyLifetimeDays: 365,
  allowDataExport: false,
  restrictWorkspaceCreationToAdmins: true,
  mfa: { status: 'unsupported' },
  version: 1,
}

export async function getOrCreateSecurityPolicy(
  organizationId: string
): Promise<SecurityPolicyDoc> {
  await connectDB()
  let doc = await OrganizationSecurityPolicy.findOne({ organizationId }).lean()
  if (!doc) {
    doc = (
      await OrganizationSecurityPolicy.create({
        organizationId,
        ...DEFAULTS,
      })
    ).toObject()
  }
  return {
    organizationId: String(doc.organizationId),
    allowedInviteEmailDomains: doc.allowedInviteEmailDomains || [],
    allowGuestAccess: doc.allowGuestAccess !== false,
    whoCanInvite: doc.whoCanInvite || 'admin',
    allowApiKeyCreation: Boolean(doc.allowApiKeyCreation),
    maxApiKeyLifetimeDays: doc.maxApiKeyLifetimeDays || 365,
    allowDataExport: Boolean(doc.allowDataExport),
    restrictWorkspaceCreationToAdmins: doc.restrictWorkspaceCreationToAdmins !== false,
    mfa: { status: 'unsupported' },
    version: doc.version || 1,
  }
}

export async function updateSecurityPolicy(params: {
  organizationId: string
  actor: PermissionActor
  patch: Partial<{
    allowedInviteEmailDomains: string[]
    allowGuestAccess: boolean
    whoCanInvite: 'owner' | 'admin' | 'members_with_permission'
    allowApiKeyCreation: boolean
    maxApiKeyLifetimeDays: number
    allowDataExport: boolean
    restrictWorkspaceCreationToAdmins: boolean
  }>
}) {
  if (!isGovernanceSecurityPoliciesEnabled()) {
    throw new AppError('Security policies are disabled', 403)
  }
  if (!hasPermission(params.actor, 'security.manage', {
    resourceOrganizationId: params.organizationId,
  })) {
    throw new AppError('Forbidden', 403)
  }
  if ('mfa' in (params.patch as object)) {
    throw new AppError('MFA is unsupported and cannot be configured', 400)
  }

  await connectDB()
  const before = await getOrCreateSecurityPolicy(params.organizationId)
  const domains = (params.patch.allowedInviteEmailDomains || before.allowedInviteEmailDomains)
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean)

  const doc = await OrganizationSecurityPolicy.findOneAndUpdate(
    { organizationId: params.organizationId },
    {
      $set: {
        ...params.patch,
        allowedInviteEmailDomains: domains,
        mfa: { status: 'unsupported' },
        updatedBy: params.actor.userId,
      },
      $inc: { version: 1 },
    },
    { new: true, upsert: true }
  ).lean()

  await writeCriticalAudit({
    organizationId: params.organizationId,
    actorUserId: params.actor.userId,
    action: 'security.policy_updated',
    resourceType: 'OrganizationSecurityPolicy',
    resourceId: params.organizationId,
    before,
    after: doc,
    source: 'api',
  })

  return getOrCreateSecurityPolicy(params.organizationId)
}

export function assertInviteEmailAllowed(policy: SecurityPolicyDoc, email: string): void {
  if (!isGovernanceSecurityPoliciesEnabled()) return
  const domains = policy.allowedInviteEmailDomains || []
  if (!domains.length) return
  const domain = email.split('@')[1]?.toLowerCase()
  if (!domain || !domains.includes(domain)) {
    throw new AppError('Invitation email domain is not allowed by organization policy', 403)
  }
}

export function assertGuestAccessAllowed(policy: SecurityPolicyDoc): void {
  if (!isGovernanceSecurityPoliciesEnabled()) return
  if (!policy.allowGuestAccess) {
    throw new AppError('Guest access is disabled by organization policy', 403)
  }
}

export function assertDataExportAllowed(policy: SecurityPolicyDoc): void {
  if (!isGovernanceSecurityPoliciesEnabled()) return
  if (!policy.allowDataExport) {
    throw new AppError('Data export is disabled by organization policy', 403)
  }
}
