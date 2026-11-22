import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  assertPermission,
  assertValidPermission,
  getEffectivePermissions,
  hasPermission,
  hasPlatformAdminRole,
  isOwnerOnlyPermission,
  isPermission,
  listPermissions,
  permissionActorFromTenant,
  PERMISSIONS,
  type PermissionActor,
} from './index'
import { isGovernanceEnforcementEnabled } from '../flags'
import { AppError } from '@/lib/api/errors'
import { canAccessProject } from '@/lib/auth/access'

function actor(partial: Partial<PermissionActor> = {}): PermissionActor {
  return {
    userId: 'u1',
    organizationId: 'org-a',
    workspaceId: 'ws-a',
    orgRole: 'member',
    workspaceRole: 'member',
    platformRole: 'none',
    legacyRole: 'member',
    ...partial,
  }
}

describe('permission catalog', () => {
  it('exposes finite unique identifiers', () => {
    const list = listPermissions()
    assert.ok(list.length >= 40)
    assert.equal(new Set(list).size, list.length)
    assert.equal(isPermission('billing.manage'), true)
    assert.equal(isPermission('billing.*'), false)
    assert.throws(() => assertValidPermission('not.a.permission'))
  })

  it('marks billing.manage and security.manage as owner-only', () => {
    assert.equal(isOwnerOnlyPermission('billing.manage'), true)
    assert.equal(isOwnerOnlyPermission('security.manage'), true)
    assert.equal(isOwnerOnlyPermission('billing.read'), false)
  })
})

describe('system role resolution', () => {
  it('grants org owner billing.manage and transfer', () => {
    const a = actor({ orgRole: 'owner', workspaceRole: null, workspaceId: null })
    assert.equal(hasPermission(a, 'billing.manage'), true)
    assert.equal(hasPermission(a, 'organization.transfer'), true)
    assert.equal(hasPermission(a, 'security.manage'), true)
  })

  it('denies billing.manage to org admin', () => {
    const a = actor({ orgRole: 'admin', workspaceRole: null, workspaceId: null })
    assert.equal(hasPermission(a, 'billing.read'), true)
    assert.equal(hasPermission(a, 'billing.manage'), false)
    assert.equal(hasPermission(a, 'members.invite'), true)
  })

  it('limits org member to read-level org permissions', () => {
    const a = actor({ orgRole: 'member', workspaceRole: null, workspaceId: null })
    assert.equal(hasPermission(a, 'organization.read'), true)
    assert.equal(hasPermission(a, 'members.invite'), false)
    assert.equal(hasPermission(a, 'workspaces.create'), false)
    assert.equal(hasPermission(a, 'billing.read'), false)
  })

  it('workspace guest cannot create projects or execute workflows', () => {
    const a = actor({ orgRole: 'member', workspaceRole: 'guest' })
    assert.equal(hasPermission(a, 'projects.read'), true)
    assert.equal(hasPermission(a, 'projects.create'), false)
    assert.equal(hasPermission(a, 'workflows.execute'), false)
  })

  it('workspace member can create projects and execute workflows', () => {
    const a = actor({ orgRole: 'member', workspaceRole: 'member' })
    assert.equal(hasPermission(a, 'projects.create'), true)
    assert.equal(hasPermission(a, 'workflows.execute'), true)
    assert.equal(hasPermission(a, 'automations.manage_schedules'), false)
  })

  it('workspace admin can manage schedules and workspace members', () => {
    const a = actor({ orgRole: 'member', workspaceRole: 'admin' })
    assert.equal(hasPermission(a, 'automations.manage_schedules'), true)
    assert.equal(hasPermission(a, 'workspaces.members.manage'), true)
  })

  it('covers every org and workspace system role with a non-empty set where membership exists', () => {
    for (const orgRole of ['owner', 'admin', 'member'] as const) {
      const set = getEffectivePermissions(
        actor({ orgRole, workspaceRole: null, workspaceId: null })
      )
      assert.ok(set.size > 0, `org ${orgRole}`)
    }
    for (const workspaceRole of ['owner', 'admin', 'member', 'guest'] as const) {
      const set = getEffectivePermissions(actor({ orgRole: 'member', workspaceRole }))
      assert.ok(set.size > 0, `ws ${workspaceRole}`)
    }
  })
})

describe('isolation and safeguards', () => {
  it('rejects cross-organization resource checks', () => {
    const a = actor({ orgRole: 'owner', organizationId: 'org-a' })
    assert.equal(
      hasPermission(a, 'organization.read', { resourceOrganizationId: 'org-b' }),
      false
    )
  })

  it('rejects cross-workspace resource checks', () => {
    const a = actor({ orgRole: 'member', workspaceRole: 'admin', workspaceId: 'ws-a' })
    assert.equal(
      hasPermission(a, 'projects.create', { resourceWorkspaceId: 'ws-b' }),
      false
    )
  })

  it('denies all permissions without organization membership', () => {
    const a = actor({
      organizationId: null,
      orgRole: null,
      workspaceId: null,
      workspaceRole: null,
    })
    assert.equal(hasPermission(a, 'organization.read'), false)
    assert.equal(getEffectivePermissions(a).size, 0)
  })

  it('strips owner-only permissions from extras (custom role simulation)', () => {
    const a = actor({
      orgRole: 'admin',
      workspaceRole: null,
      workspaceId: null,
      extraPermissions: ['billing.manage', 'billing.read', 'not.real'],
    })
    assert.equal(hasPermission(a, 'billing.manage'), false)
    // billing.read already granted via admin map; extras cannot add owner-only
    assert.equal(hasPermission(a, 'billing.read'), true)
    const effective = getEffectivePermissions(a)
    assert.equal(effective.has('billing.manage'), false)
  })

  it('never grants permissions from legacy User.role=admin', () => {
    const a = actor({
      orgRole: 'member',
      workspaceRole: 'guest',
      legacyRole: 'admin',
      platformRole: 'none',
    })
    assert.equal(hasPermission(a, 'billing.manage'), false)
    assert.equal(hasPermission(a, 'members.invite'), false)
    assert.equal(hasPermission(a, 'projects.create'), false)
  })

  it('keeps platform admin separate from org permissions', () => {
    const a = actor({
      orgRole: 'member',
      platformRole: 'platform_admin',
      workspaceRole: null,
      workspaceId: null,
    })
    assert.equal(hasPlatformAdminRole(a), true)
    assert.equal(hasPermission(a, 'billing.manage'), false)
    assert.equal(hasPermission(a, 'organization.delete'), false)
  })

  it('assertPermission throws AppError 403 when denied', () => {
    const a = actor({ orgRole: 'member', workspaceRole: 'guest' })
    assert.throws(() => assertPermission(a, 'billing.manage'), (err: unknown) => {
      return err instanceof AppError && err.status === 403
    })
  })

  it('permissionActorFromTenant copies verified fields only', () => {
    const a = permissionActorFromTenant({
      userId: 'u1',
      organizationId: 'org-a',
      workspaceId: 'ws-a',
      orgRole: 'admin',
      workspaceRole: 'member',
      platformRole: 'none',
      legacyRole: 'admin',
    })
    assert.equal(a.orgRole, 'admin')
    assert.equal(a.legacyRole, 'admin')
    assert.equal(hasPermission(a, 'members.invite'), true)
  })
})

describe('project ACL compatibility (unchanged path)', () => {
  it('still requires project membership for workspace members', () => {
    const project = {
      ownerId: 'other',
      members: ['u1'],
      workspaceId: 'ws-a',
    }
    assert.equal(
      canAccessProject(project, { id: 'u1', role: 'member' }, {
        workspaceId: 'ws-a',
        workspaceRole: 'member',
        dualReadLegacy: false,
      }),
      true
    )
    assert.equal(
      canAccessProject(project, { id: 'u2', role: 'member' }, {
        workspaceId: 'ws-a',
        workspaceRole: 'member',
        dualReadLegacy: false,
      }),
      false
    )
  })

  it('workspace admin still bypasses project ACL', () => {
    const project = { ownerId: 'other', members: [], workspaceId: 'ws-a' }
    assert.equal(
      canAccessProject(project, { id: 'u2', role: 'member' }, {
        workspaceId: 'ws-a',
        workspaceRole: 'admin',
        dualReadLegacy: false,
      }),
      true
    )
  })
})

describe('governance enforcement flag', () => {
  it('defaults to disabled', () => {
    const prev = process.env.GOVERNANCE_ENFORCEMENT_ENABLED
    delete process.env.GOVERNANCE_ENFORCEMENT_ENABLED
    assert.equal(isGovernanceEnforcementEnabled(), false)
    process.env.GOVERNANCE_ENFORCEMENT_ENABLED = 'true'
    assert.equal(isGovernanceEnforcementEnabled(), true)
    if (prev === undefined) delete process.env.GOVERNANCE_ENFORCEMENT_ENABLED
    else process.env.GOVERNANCE_ENFORCEMENT_ENABLED = prev
  })
})

describe('catalog completeness smoke', () => {
  it('every catalog entry is a Permission literal', () => {
    for (const p of PERMISSIONS) {
      assert.equal(isPermission(p), true)
    }
  })
})
