'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

type Role = {
  _id: string
  name: string
  slug: string
  description?: string
  permissions: string[]
  version: number
  isActive: boolean
}

type Assignment = {
  _id: string
  userId: string
  roleId: string
  status: string
}

const DELEGABLE_OPTIONS = [
  'members.invite',
  'members.read',
  'audit.read',
  'api_keys.read',
  'workflows.read',
  'automations.read',
  'billing.read',
  'data.export',
]

export default function RolesSettingsPage() {
  const [roles, setRoles] = useState<Role[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selected, setSelected] = useState<string[]>(['members.read'])
  const [assignUserId, setAssignUserId] = useState('')
  const [assignRoleId, setAssignRoleId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [disabledHint, setDisabledHint] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [rolesRes, assignRes] = await Promise.all([
        fetch('/api/governance/roles'),
        fetch('/api/governance/roles/assignments'),
      ])
      const rolesJson = await rolesRes.json()
      const assignJson = await assignRes.json()
      if (rolesRes.status === 403 && String(rolesJson.error || '').includes('disabled')) {
        setDisabledHint(true)
      }
      if (!rolesRes.ok) throw new Error(rolesJson.error || 'Failed to load roles')
      setRoles(rolesJson.roles || [])
      if (assignRes.ok) setAssignments(assignJson.assignments || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function createRole(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    setError(null)
    const res = await fetch('/api/governance/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, permissions: selected }),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error || 'Create failed')
      if (String(json.error || '').includes('disabled')) setDisabledHint(true)
      return
    }
    setMessage('Role created')
    setName('')
    setDescription('')
    await load()
  }

  async function assign(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    setError(null)
    const res = await fetch('/api/governance/roles/assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roleId: assignRoleId, userId: assignUserId }),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error || 'Assign failed')
      return
    }
    setMessage('Role assigned')
    setAssignUserId('')
    await load()
  }

  async function revoke(assignmentId: string) {
    setError(null)
    const res = await fetch('/api/governance/roles/assignments', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignmentId }),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error || 'Revoke failed')
      return
    }
    setMessage('Assignment revoked')
    await load()
  }

  function togglePerm(p: string) {
    setSelected((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]))
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      <div>
        <Link href="/settings" style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          ← Settings
        </Link>
        <h1 className="text-2xl font-semibold mt-2" style={{ color: 'var(--text-primary)' }}>
          Custom roles
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Organization-scoped roles that add permissions on top of system membership roles.
          Owner-only permissions such as billing.manage cannot be delegated.
        </p>
      </div>

      {disabledHint && (
        <div
          className="rounded-lg p-3 text-sm"
          style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
        >
          Custom roles require <code>GOVERNANCE_CUSTOM_ROLES_ENABLED=true</code> in the server
          environment.
        </div>
      )}

      {loading && <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>}
      {error && (
        <p className="text-sm" style={{ color: 'var(--danger, #b91c1c)' }}>
          {error}
        </p>
      )}
      {message && (
        <p className="text-sm" style={{ color: 'var(--brand-700)' }}>
          {message}
        </p>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>
          Existing roles
        </h2>
        {!loading && roles.length === 0 && (
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            No custom roles yet.
          </p>
        )}
        <ul className="space-y-2">
          {roles.map((r) => (
            <li
              key={r._id}
              className="rounded-lg p-3"
              style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
            >
              <div className="font-medium" style={{ color: 'var(--text-primary)' }}>
                {r.name}{' '}
                <span className="text-xs font-normal" style={{ color: 'var(--text-secondary)' }}>
                  ({r.slug}) v{r.version}
                </span>
              </div>
              {r.description && (
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                  {r.description}
                </p>
              )}
              <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
                {r.permissions.join(', ') || 'No permissions'}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-medium mb-3" style={{ color: 'var(--text-primary)' }}>
          Create role
        </h2>
        <form onSubmit={createRole} className="space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Role name"
            required
            className="w-full rounded-md px-3 py-2 text-sm"
            style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
            className="w-full rounded-md px-3 py-2 text-sm"
            style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
          />
          <div className="flex flex-wrap gap-2">
            {DELEGABLE_OPTIONS.map((p) => (
              <label key={p} className="text-xs flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={selected.includes(p)}
                  onChange={() => togglePerm(p)}
                />
                {p}
              </label>
            ))}
          </div>
          <button
            type="submit"
            className="rounded-md px-4 py-2 text-sm font-medium"
            style={{ background: 'var(--brand-600)', color: '#fff' }}
          >
            Create role
          </button>
        </form>
      </section>

      <section>
        <h2 className="text-lg font-medium mb-3" style={{ color: 'var(--text-primary)' }}>
          Assignments
        </h2>
        <form onSubmit={assign} className="space-y-3 mb-4">
          <input
            value={assignUserId}
            onChange={(e) => setAssignUserId(e.target.value)}
            placeholder="Member user ID"
            required
            className="w-full rounded-md px-3 py-2 text-sm"
            style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
          />
          <select
            value={assignRoleId}
            onChange={(e) => setAssignRoleId(e.target.value)}
            required
            className="w-full rounded-md px-3 py-2 text-sm"
            style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
          >
            <option value="">Select role</option>
            {roles.map((r) => (
              <option key={r._id} value={r._id}>
                {r.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-md px-4 py-2 text-sm font-medium"
            style={{ background: 'var(--brand-600)', color: '#fff' }}
          >
            Assign
          </button>
        </form>
        <ul className="space-y-2">
          {assignments.map((a) => (
            <li
              key={a._id}
              className="flex items-center justify-between rounded-lg p-3 text-sm"
              style={{ border: '1px solid var(--border)' }}
            >
              <span style={{ color: 'var(--text-secondary)' }}>
                user {a.userId} → role {a.roleId}
              </span>
              <button
                type="button"
                onClick={() => void revoke(a._id)}
                className="text-xs"
                style={{ color: 'var(--danger, #b91c1c)' }}
              >
                Revoke
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
