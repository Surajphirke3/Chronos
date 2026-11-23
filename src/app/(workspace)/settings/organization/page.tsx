'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

type Org = {
  _id: string
  name: string
  slug: string
  description?: string
  logoUrl?: string
}

type Member = {
  role: string
  status: string
  user: { _id: string; name: string; email: string; avatarUrl?: string } | null
}

type Invitation = {
  _id: string
  email: string
  role: string
  scope: string
  expiresAt: string
  status: string
}

export default function OrganizationSettingsPage() {
  const [org, setOrg] = useState<Org | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'member' | 'guest'>('member')
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
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
      if (!ctx.organizationId) {
        setOrg(null)
        setLoading(false)
        return
      }
      setWorkspaceId(ctx.workspaceId)

      const [orgRes, memRes, invRes] = await Promise.all([
        fetch(`/api/organizations/${ctx.organizationId}`),
        fetch(`/api/organizations/${ctx.organizationId}/members`),
        fetch(`/api/invitations?organizationId=${ctx.organizationId}`),
      ])
      const orgJson = await orgRes.json()
      const memJson = await memRes.json()
      const invJson = await invRes.json()
      if (!orgRes.ok) throw new Error(orgJson.error || 'Failed to load organization')
      setOrg(orgJson.organization)
      setRole(orgJson.role)
      setName(orgJson.organization.name || '')
      setDescription(orgJson.organization.description || '')
      setLogoUrl(orgJson.organization.logoUrl || '')
      if (memRes.ok) setMembers(memJson.members || [])
      if (invRes.ok) setInvitations(invJson.invitations || [])
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
    if (!org) return
    setMessage(null)
    setError(null)
    const res = await fetch(`/api/organizations/${org._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, logoUrl }),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error || 'Save failed')
      return
    }
    setOrg(json.organization)
    setMessage('Organization updated')
  }

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!org || !workspaceId) return
    setMessage(null)
    setError(null)
    const res = await fetch('/api/invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationId: org._id,
        workspaceId,
        email: inviteEmail,
        role: inviteRole,
        scope: 'workspace',
      }),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error || 'Invite failed')
      return
    }
    setInviteEmail('')
    setMessage('Invitation sent')
    void load()
  }

  async function revokeInvite(id: string) {
    setError(null)
    const res = await fetch(`/api/invitations/${id}/revoke`, { method: 'POST' })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error || 'Revoke failed')
      return
    }
    void load()
  }

  if (loading) {
    return <p style={{ color: 'var(--text-secondary)' }}>Loading organization…</p>
  }

  if (!org) {
    return (
      <div>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 12 }}>
          You are not in an organization yet.
        </p>
        <Link href="/onboarding" style={{ color: 'var(--brand-700)' }}>
          Create or join an organization
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
        <span style={{ color: 'var(--text-tertiary)' }}> / Organization</span>
      </div>
      <h1 style={{ fontSize: 22, fontWeight: 650, marginBottom: 4 }}>Organization</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>
        Your role: {role || 'member'}
      </p>

      {error && (
        <div style={{ marginBottom: 12, color: '#b91c1c', fontSize: 13 }}>{error}</div>
      )}
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
          <input value={org.slug} disabled style={inputStyle} />
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
        <label style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Logo URL
          <input
            value={logoUrl}
            disabled={!canAdmin}
            onChange={(e) => setLogoUrl(e.target.value)}
            style={inputStyle}
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

      {canAdmin && (
        <>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Invite member</h2>
          <form onSubmit={sendInvite} style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
            <input
              type="email"
              required
              placeholder="email@company.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              style={{ ...inputStyle, flex: 1, minWidth: 200, marginTop: 0 }}
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as typeof inviteRole)}
              style={{ ...inputStyle, width: 120, marginTop: 0 }}
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
              <option value="guest">Guest</option>
            </select>
            <button type="submit" style={primaryBtn}>
              Send invite
            </button>
          </form>

          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Pending invitations</h2>
          {invitations.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>No pending invitations.</p>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {invitations.map((inv) => (
                <div
                  key={inv._id}
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
                    <div style={{ fontWeight: 500 }}>{inv.email}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {inv.role} · expires {new Date(inv.expiresAt).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void revokeInvite(inv._id)}
                    style={{
                      border: '1px solid var(--border-subtle)',
                      background: 'transparent',
                      borderRadius: 'var(--radius)',
                      padding: '6px 10px',
                      cursor: 'pointer',
                      fontSize: 12,
                    }}
                  >
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <div style={{ marginTop: 32 }}>
        <Link href="/settings/workspace" style={{ color: 'var(--brand-700)', fontSize: 14 }}>
          Workspace settings →
        </Link>
      </div>
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
