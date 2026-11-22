import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  canAccessProject,
  projectVisibilityFilter,
  pickAllowedFields,
  maskSecret,
  shouldUpdateSecret,
  PROJECT_PATCH_FIELDS,
} from './access'

describe('canAccessProject', () => {
  const project = {
    ownerId: 'owner-1',
    members: ['member-1', 'member-2'],
  }

  it('allows the owner', () => {
    assert.equal(canAccessProject(project, { id: 'owner-1', role: 'member' }), true)
  })

  it('allows listed members', () => {
    assert.equal(canAccessProject(project, { id: 'member-2', role: 'member' }), true)
  })

  it('allows admins even when not a member', () => {
    assert.equal(canAccessProject(project, { id: 'outsider', role: 'admin' }), true)
  })

  it('denies non-members', () => {
    assert.equal(canAccessProject(project, { id: 'outsider', role: 'member' }), false)
  })

  it('denies null project', () => {
    assert.equal(canAccessProject(null, { id: 'owner-1' }), false)
  })
})

describe('projectVisibilityFilter', () => {
  it('returns empty filter for admins', () => {
    assert.deepEqual(projectVisibilityFilter({ id: 'u1', role: 'admin' }), {})
  })

  it('scopes non-admins to owner or members', () => {
    assert.deepEqual(projectVisibilityFilter({ id: 'u1', role: 'member' }), {
      $or: [{ ownerId: 'u1' }, { members: 'u1' }],
    })
  })
})

describe('pickAllowedFields', () => {
  it('only keeps whitelisted keys', () => {
    const result = pickAllowedFields(
      { name: 'A', ownerId: 'hack', status: 'active', unknown: true },
      PROJECT_PATCH_FIELDS
    )
    assert.deepEqual(result, { name: 'A', status: 'active' })
    assert.equal('ownerId' in result, false)
  })
})

describe('secret helpers', () => {
  it('maskSecret never returns the raw value', () => {
    assert.deepEqual(maskSecret('super-secret'), { value: '', isSet: true })
    assert.deepEqual(maskSecret(''), { value: '', isSet: false })
  })

  it('shouldUpdateSecret rejects blanks and placeholders', () => {
    assert.equal(shouldUpdateSecret(''), false)
    assert.equal(shouldUpdateSecret('••••'), false)
    assert.equal(shouldUpdateSecret('[REDACTED]'), false)
    assert.equal(shouldUpdateSecret('real-password'), true)
  })
})
