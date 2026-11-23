'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

export default function OnboardingPage() {
  const router = useRouter()
  const { data: session, update } = useSession()
  const [mode, setMode] = useState<'create' | 'invite'>('create')
  const [name, setName] = useState('')
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function createOrg(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to create organization')
      await update?.()
      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  async function acceptInvite(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to accept invitation')
      await update?.()
      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: '40px auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 650, marginBottom: 8, color: 'var(--text-primary)' }}>
        Set up your workspace
      </h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: 14 }}>
        Welcome{session?.user?.name ? `, ${session.user.name}` : ''}. Create an organization or join
        with an invitation.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button
          type="button"
          onClick={() => setMode('create')}
          style={{
            flex: 1,
            padding: '8px 12px',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border-subtle)',
            background: mode === 'create' ? 'var(--brand-50)' : 'var(--bg-elevated)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          Create organization
        </button>
        <button
          type="button"
          onClick={() => setMode('invite')}
          style={{
            flex: 1,
            padding: '8px 12px',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border-subtle)',
            background: mode === 'invite' ? 'var(--brand-50)' : 'var(--bg-elevated)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          Join with invite
        </button>
      </div>

      {error && (
        <div
          style={{
            padding: 12,
            marginBottom: 16,
            borderRadius: 'var(--radius)',
            background: 'rgba(185,28,28,0.08)',
            color: '#b91c1c',
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {mode === 'create' ? (
        <form onSubmit={createOrg} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Organization name
            <input
              required
              minLength={2}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Dimensity Labs"
              style={{
                display: 'block',
                width: '100%',
                marginTop: 6,
                padding: '10px 12px',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-elevated)',
                color: 'var(--text-primary)',
              }}
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius)',
              border: 'none',
              background: 'var(--brand-700)',
              color: '#fff',
              fontWeight: 550,
              cursor: loading ? 'wait' : 'pointer',
            }}
          >
            {loading ? 'Creating…' : 'Create and continue'}
          </button>
        </form>
      ) : (
        <form onSubmit={acceptInvite} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Invitation token
            <input
              required
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste invitation token"
              style={{
                display: 'block',
                width: '100%',
                marginTop: 6,
                padding: '10px 12px',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-elevated)',
                color: 'var(--text-primary)',
              }}
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius)',
              border: 'none',
              background: 'var(--brand-700)',
              color: '#fff',
              fontWeight: 550,
              cursor: loading ? 'wait' : 'pointer',
            }}
          >
            {loading ? 'Joining…' : 'Accept invitation'}
          </button>
        </form>
      )}
    </div>
  )
}
