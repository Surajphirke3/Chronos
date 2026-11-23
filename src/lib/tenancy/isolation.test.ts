import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { canAccessProject, projectVisibilityFilter } from '@/lib/auth/access'
import { mergeMongoFilters, assertResourceInWorkspace } from '@/lib/tenancy/http'
import { isValidSlug, slugify } from '@/lib/tenancy/slug'

describe('tenant isolation helpers', () => {
  it('rejects cross-workspace project access', () => {
    const project = {
      ownerId: 'user-a',
      members: ['user-a'],
      workspaceId: 'ws-a',
    }
    assert.equal(
      canAccessProject(
        project,
        { id: 'user-a', role: 'member' },
        { workspaceId: 'ws-b', workspaceRole: 'member', dualReadLegacy: false }
      ),
      false
    )
    assert.equal(
      canAccessProject(
        project,
        { id: 'user-a', role: 'member' },
        { workspaceId: 'ws-a', workspaceRole: 'member', dualReadLegacy: false }
      ),
      true
    )
  })

  it('does not allow legacy admin to bypass a foreign workspace', () => {
    const project = {
      ownerId: 'other',
      members: [],
      workspaceId: 'ws-a',
    }
    assert.equal(
      canAccessProject(
        project,
        { id: 'admin-user', role: 'admin' },
        { workspaceId: 'ws-b', workspaceRole: 'admin', dualReadLegacy: false }
      ),
      false
    )
  })

  it('scopes visibility filter to workspace', () => {
    const filter = projectVisibilityFilter(
      { id: 'u1', role: 'member' },
      { workspaceId: 'ws-1', workspaceRole: 'member', dualReadLegacy: false }
    )
    assert.ok(JSON.stringify(filter).includes('ws-1'))
    assert.ok(JSON.stringify(filter).includes('u1'))
  })

  it('workspace admin sees all projects in workspace filter', () => {
    const filter = projectVisibilityFilter(
      { id: 'u1', role: 'member' },
      { workspaceId: 'ws-1', workspaceRole: 'admin', dualReadLegacy: false }
    )
    assert.deepEqual(filter, { workspaceId: 'ws-1' })
  })

  it('assertResourceInWorkspace rejects foreign workspace ids', () => {
    assert.equal(assertResourceInWorkspace({ workspaceId: 'ws-a' }, 'ws-b', false), false)
    assert.equal(assertResourceInWorkspace({ workspaceId: 'ws-a' }, 'ws-a', false), true)
  })

  it('mergeMongoFilters combines clauses', () => {
    assert.deepEqual(mergeMongoFilters({ a: 1 }, { b: 2 }), { $and: [{ a: 1 }, { b: 2 }] })
  })
})

describe('slug helpers', () => {
  it('slugifies and validates', () => {
    assert.equal(slugify('Dimensity Labs'), 'dimensity-labs')
    assert.equal(isValidSlug('dimensity-labs'), true)
    assert.equal(isValidSlug('Bad Slug'), false)
    assert.equal(isValidSlug('a'), false)
  })
})
