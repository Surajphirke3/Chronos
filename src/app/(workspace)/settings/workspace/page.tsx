'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

type Workspace = {
  _id: string
  name: string
  slug: string
  description?: string
  type?: string
  status?: string
  isDefault?: boolean
}

type Member = {
  role: string
  user: { _id: string; name: string; email: string } | null
}

export default function WorkspaceSettingsPage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const ctxRes = await fetch('/api/context')
      const ctx = await ctxRes.json()
      if (!ctxRes.ok) throw new Error(ctx.error || 'Failed to load context')
      if (!ctx.workspaceId) {
        setWorkspace(null)
        setLoading(false)
        return
      }

      const [wsRes, memRes] = await Promise.all([
        fetch(`/api/workspaces/${ctx.workspaceId}`),
        fetch(`/api/workspaces/${ctx.workspaceId}/members`),
      ])
      const wsJson = await wsRes.json()
      const memJson = await memRes.json()
      if (!wsRes.ok) throw new Error(wsJson.error || 'Failed to load workspace')
      setWorkspace(wsJson.workspace)
      setRole(wsJson.role)
      setName(wsJson.workspace.name || '')
      setDescription(wsJson.workspace.description || '')
      if (memRes.ok) setMembers(memJson.members || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!workspace) return
    setMessage(null)
    setError(null)
    const res = await fetch(`/api/workspaces/${workspace._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error || 'Save failed')
      return
    }
    setWorkspace(json.workspace)
    setMessage('Workspace updated')
  }

  async function archive() {
    if (!workspace || workspace.isDefault) return
    if (!window.confirm('Archive this workspace? Members will lose access.')) return
    setError(null)
    const res = await fetch(`/api/workspaces/${workspace._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'archived' }),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error || 'Archive failed')
      return
    }
    setMessage('Workspace archived')
    setWorkspace(json.workspace)
  }

  if (loading) return <p style={{ color: 'var(--text-secondary)' }}>Loading workspace…</p>

  if (!workspace) {
    return (
      <div>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 12 }}>No active workspace.</p>
        <Link href="/onboarding" style={{ color: 'var(--brand-700)' }}>
          Set up an organization
        </Link>
      </div>
    )
  }

  const canAdmin = role === 'owner' || role === 'admin'

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 8, fontSize: 13 }}>
        <Link href="/settings" style={{ color: 'var(--text-secondary)' }}>
          Settings
        </Link>
        <span style={{ color: 'var(--text-tertiary)' }}> / Workspace</span>
      </div>
      <h1 style={{ fontSize: 22, fontWeight: 650, marginBottom: 4 }}>Workspace</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>
        Your role: {role || 'member'}
      </p>

      {error && <div style={{ marginBottom: 12, color: '#b91c1c', fontSize: 13 }}>{error}</div>}
      {message && (
        <div style={{ marginBottom: 12, color: 'var(--brand-700)', fontSize: 13 }}>{message}</div>
      )}

      <form onSubmit={save} style={{ display: 'grid', gap: 12, marginBottom: 32 }}>
        <label style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Name
          <input
            value={name}
            disabled={!canAdmin}
            onChange={(e) => setName(e.target.value)}
            style={inputStyle}
          />
        </label>
        <label style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Slug
          <input value={workspace.slug} disabled style={inputStyle} />
        </label>
        <label style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Description
          <textarea
            value={description}
            disabled={!canAdmin}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </label>
        {canAdmin && (
          <button type="submit" style={primaryBtn}>
            Save changes
          </button>
        )}
      </form>

      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Members</h2>
      <div style={{ display: 'grid', gap: 8, marginBottom: 32 }}>
        {members.map((m, i) => (
          <div
            key={m.user?._id || i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 12px',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius)',
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500 }}>{m.user?.name || 'Unknown'}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{m.user?.email}</div>
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{m.role}</span>
          </div>
        ))}
      </div>

      {canAdmin && !workspace.isDefault && workspace.status !== 'archived' && (
        <button
          type="button"
          onClick={() => void archive()}
          style={{
            padding: '10px 14px',
            borderRadius: 'var(--radius)',
            border: '1px solid #b91c1c',
            background: 'transparent',
            color: '#b91c1c',
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          Archive workspace
        </button>
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: 6,
  padding: '10px 12px',
  borderRadius: 'var(--radius)',
  border: '1px solid var(--border-subtle)',
  background: 'var(--bg-elevated)',
  color: 'var(--text-primary)',
}

const primaryBtn: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 'var(--radius)',
  border: 'none',
  background: 'var(--brand-700)',
  color: '#fff',
  fontWeight: 550,
  cursor: 'pointer',
  width: 'fit-content',
}
