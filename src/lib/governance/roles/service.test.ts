import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import {
  sanitizeDelegablePermissions,
} from './service'
import type { PermissionActor } from '@/lib/governance/permissions'
import { AppError } from '@/lib/api/errors'

function ownerActor(): PermissionActor {
  return {
    userId: 'u1',
    organizationId: 'org-a',
    orgRole: 'owner',
    workspaceRole: null,
    platformRole: 'none',
  }
}

function adminActor(): PermissionActor {
  return {
    userId: 'u2',
    organizationId: 'org-a',
    orgRole: 'admin',
    workspaceRole: null,
    platformRole: 'none',
  }
}

describe('custom role permission delegation', () => {
  it('allows admin to delegate members.invite', () => {
    const perms = sanitizeDelegablePermissions(['members.invite'], adminActor())
    assert.deepEqual(perms, ['members.invite'])
  })

  it('rejects billing.manage even for owner via custom role path', () => {
    assert.throws(
      () => sanitizeDelegablePermissions(['billing.manage'], ownerActor()),
      (e: unknown) => e instanceof AppError && e.status === 403
    )
  })

  it('rejects permissions the actor does not hold', () => {
    assert.throws(
      () => sanitizeDelegablePermissions(['security.manage'], adminActor()),
      (e: unknown) => e instanceof AppError
    )
  })

  it('rejects invalid permission identifiers', () => {
    assert.throws(
      () => sanitizeDelegablePermissions(['not.real'], adminActor()),
      (e: unknown) => e instanceof AppError && e.status === 400
    )
  })
})

describe('custom roles feature flag', () => {
  let prev: string | undefined
  before(() => {
    prev = process.env.GOVERNANCE_CUSTOM_ROLES_ENABLED
  })
  after(() => {
    if (prev === undefined) delete process.env.GOVERNANCE_CUSTOM_ROLES_ENABLED
    else process.env.GOVERNANCE_CUSTOM_ROLES_ENABLED = prev
  })

  it('defaults disabled', async () => {
    delete process.env.GOVERNANCE_CUSTOM_ROLES_ENABLED
    const { isGovernanceCustomRolesEnabled } = await import('@/lib/governance/flags')
    assert.equal(isGovernanceCustomRolesEnabled(), false)
  })
})
