import { createHash, randomBytes } from 'crypto'
import { connectDB } from '@/lib/mongodb/client'
import { Invitation } from '@/lib/mongodb/models/Invitation'
import { Membership } from '@/lib/mongodb/models/Membership'
import { WorkspaceMembership } from '@/lib/mongodb/models/WorkspaceMembership'
import { User } from '@/lib/mongodb/models/User'
import { Workspace } from '@/lib/mongodb/models/Workspace'
import { AppError } from '@/lib/api/errors'
import { canAssignOrgRole, canAssignWorkspaceRole } from '@/lib/tenancy/roles'

export function hashInviteToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function generateInviteToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('base64url')
  return { token, tokenHash: hashInviteToken(token) }
}

export async function createInvitation(params: {
  organizationId: string
  workspaceId?: string | null
  email: string
  role: string
  scope: 'organization' | 'workspace'
  invitedBy: string
  actorOrgRole: string
  actorWorkspaceRole?: string | null
  expiresInMs?: number
}): Promise<{ invitationId: string; token: string; expiresAt: Date }> {
  const email = params.email.toLowerCase().trim()
  if (!email.includes('@')) throw new AppError('Invalid email', 400)

  if (params.scope === 'organization') {
    if (!canAssignOrgRole(params.actorOrgRole, params.role === 'guest' ? 'member' : params.role)) {
      throw new AppError('Cannot assign this organization role', 403)
    }
  } else {
    if (!params.workspaceId) throw new AppError('workspaceId required', 400)
    if (!canAssignWorkspaceRole(params.actorWorkspaceRole || undefined, params.role)) {
      throw new AppError('Cannot assign this workspace role', 403)
    }
  }

  await connectDB()

  const existingPending = await Invitation.findOne({
    organizationId: params.organizationId,
    email,
    status: 'pending',
    workspaceId: params.workspaceId || null,
  })
  if (existingPending) {
    throw new AppError('An active invitation already exists for this email', 409)
  }

  const { token, tokenHash } = generateInviteToken()
  const expiresAt = new Date(Date.now() + (params.expiresInMs || 7 * 24 * 60 * 60 * 1000))

  const invitation = await Invitation.create({
    organizationId: params.organizationId,
    workspaceId: params.workspaceId || undefined,
    email,
    role: params.role,
    scope: params.scope,
    tokenHash,
    status: 'pending',
    expiresAt,
    invitedBy: params.invitedBy,
  })

  return { invitationId: String(invitation._id), token, expiresAt }
}

export async function acceptInvitation(params: {
  token: string
  userId: string
  userEmail: string
}): Promise<{ organizationId: string; workspaceId: string | null }> {
  await connectDB()
  const tokenHash = hashInviteToken(params.token)

  const invitation = await Invitation.findOneAndUpdate(
    {
      tokenHash,
      status: 'pending',
      expiresAt: { $gt: new Date() },
    },
    {
      $set: {
        status: 'accepted',
        acceptedAt: new Date(),
        acceptedBy: params.userId,
      },
    },
    { new: true }
  )

  if (!invitation) {
    throw new AppError('Invitation is invalid, expired, or already used', 400)
  }

  if (invitation.email.toLowerCase() !== params.userEmail.toLowerCase().trim()) {
    // Roll back acceptance for email mismatch
    await Invitation.updateOne(
      { _id: invitation._id },
      { $set: { status: 'pending' }, $unset: { acceptedAt: 1, acceptedBy: 1 } }
    )
    throw new AppError('Invitation email does not match the signed-in account', 403)
  }

  const orgRole = invitation.scope === 'organization'
    ? invitation.role === 'guest'
      ? 'member'
      : invitation.role
    : 'member'

  await Membership.findOneAndUpdate(
    { organizationId: invitation.organizationId, userId: params.userId },
    {
      $set: {
        status: 'active',
        role: orgRole,
        joinedAt: new Date(),
        invitedBy: invitation.invitedBy,
      },
      $setOnInsert: {
        organizationId: invitation.organizationId,
        userId: params.userId,
      },
    },
    { upsert: true }
  )

  let workspaceId = invitation.workspaceId ? String(invitation.workspaceId) : null

  if (invitation.scope === 'workspace' && invitation.workspaceId) {
    await WorkspaceMembership.findOneAndUpdate(
      { workspaceId: invitation.workspaceId, userId: params.userId },
      {
        $set: {
          organizationId: invitation.organizationId,
          status: 'active',
          role: invitation.role,
          joinedAt: new Date(),
          invitedBy: invitation.invitedBy,
        },
        $setOnInsert: {
          workspaceId: invitation.workspaceId,
          userId: params.userId,
        },
      },
      { upsert: true }
    )
  } else if (invitation.scope === 'organization') {
    // Grant membership on the default workspace if present
    const defaultWs = await Workspace.findOne({
      organizationId: invitation.organizationId,
      isDefault: true,
      status: 'active',
    }).lean()
    if (defaultWs) {
      workspaceId = String(defaultWs._id)
      await WorkspaceMembership.findOneAndUpdate(
        { workspaceId: defaultWs._id, userId: params.userId },
        {
          $set: {
            organizationId: invitation.organizationId,
            status: 'active',
            role: 'member',
            joinedAt: new Date(),
            invitedBy: invitation.invitedBy,
          },
          $setOnInsert: {
            workspaceId: defaultWs._id,
            userId: params.userId,
          },
        },
        { upsert: true }
      )
    }
  }

  await User.findByIdAndUpdate(params.userId, {
    activeOrganizationId: invitation.organizationId,
    ...(workspaceId ? { activeWorkspaceId: workspaceId } : {}),
  })

  return {
    organizationId: String(invitation.organizationId),
    workspaceId,
  }
}
