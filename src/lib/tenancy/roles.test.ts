import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  canAssignOrgRole,
  canAssignWorkspaceRole,
  orgRoleAtLeast,
  workspaceRoleAtLeast,
} from './roles'

describe('org roles', () => {
  it('ranks owner above admin and member', () => {
    assert.equal(orgRoleAtLeast('owner', 'admin'), true)
    assert.equal(orgRoleAtLeast('admin', 'owner'), false)
    assert.equal(orgRoleAtLeast('member', 'admin'), false)
  })

  it('prevents non-owners from assigning owner', () => {
    assert.equal(canAssignOrgRole('admin', 'owner'), false)
    assert.equal(canAssignOrgRole('owner', 'owner'), true)
    assert.equal(canAssignOrgRole('admin', 'admin'), true)
    assert.equal(canAssignOrgRole('member', 'member'), false)
  })
})

describe('workspace roles', () => {
  it('ranks guest lowest', () => {
    assert.equal(workspaceRoleAtLeast('guest', 'member'), false)
    assert.equal(workspaceRoleAtLeast('member', 'guest'), true)
    assert.equal(workspaceRoleAtLeast('admin', 'admin'), true)
  })

  it('prevents role escalation', () => {
    assert.equal(canAssignWorkspaceRole('admin', 'owner'), false)
    assert.equal(canAssignWorkspaceRole('admin', 'admin'), true)
    assert.equal(canAssignWorkspaceRole('member', 'guest'), false)
    assert.equal(canAssignWorkspaceRole('owner', 'guest'), true)
  })
})
