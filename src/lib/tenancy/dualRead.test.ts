import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { workspaceScopedFilter, accessOptionsFromTenant, type TenantContext } from './context'
import { canAccessProject, projectVisibilityFilter } from '@/lib/auth/access'

function baseCtx(overrides: Partial<TenantContext> = {}): TenantContext {
  return {
    userId: 'u1',
    email: 'u1@example.com',
    legacyRole: 'member',
    platformRole: 'none',
    organizationId: 'org-1',
    workspaceId: 'ws-1',
    orgRole: 'member',
    workspaceRole: 'admin',
    allowsLegacyUnscopedRead: false,
    organization: {
      _id: 'org-1',
      name: 'Other Co',
      slug: 'other',
      status: 'active',
      migrationKey: null,
    },
    workspace: {
      _id: 'ws-1',
      name: 'Engineering',
      slug: 'engineering',
      status: 'active',
      organizationId: 'org-1',
      isDefault: true,
      migrationKey: null,
    },
    ...overrides,
  }
}

describe('dual-read legacy unscoped isolation', () => {
  it('does not include null workspaceId for non-default migration tenants', () => {
    const filter = workspaceScopedFilter(baseCtx({ allowsLegacyUnscopedRead: false }))
    assert.deepEqual(filter, { workspaceId: 'ws-1' })
    assert.equal(JSON.stringify(filter).includes('exists'), false)
  })

  it('includes null workspaceId only when allowsLegacyUnscopedRead is true', () => {
    const filter = workspaceScopedFilter(baseCtx({ allowsLegacyUnscopedRead: true }))
    assert.ok(JSON.stringify(filter).includes('ws-1'))
    assert.ok(JSON.stringify(filter).includes('exists') || JSON.stringify(filter).includes('null'))
  })

  it('accessOptionsFromTenant disables dualReadLegacy for non-default tenants', () => {
    const opts = accessOptionsFromTenant(baseCtx({ allowsLegacyUnscopedRead: false }))
    assert.equal(opts.dualReadLegacy, false)
  })

  it('non-default tenant admin cannot see foreign unscoped projects via dual-read', () => {
    const unscoped = { ownerId: 'other', members: [], workspaceId: undefined }
    const opts = accessOptionsFromTenant(baseCtx({ allowsLegacyUnscopedRead: false }))
    assert.equal(canAccessProject(unscoped, { id: 'u1', role: 'admin' }, opts), false)

    const filter = projectVisibilityFilter({ id: 'u1', role: 'member' }, opts)
    assert.deepEqual(filter, { workspaceId: 'ws-1' })
  })
})
