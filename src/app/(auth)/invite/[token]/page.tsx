'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession, signIn } from 'next-auth/react'
import Link from 'next/link'

export default function InviteAcceptPage() {
  const params = useParams<{ token: string }>()
  const token = params?.token || ''
  const router = useRouter()
  const { data: session, status, update } = useSession()
  const [preview, setPreview] = useState<{
    status: string
    email: string
    role: string
    organization?: { name: string }
    workspace?: { name: string }
    expiresAt?: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!token) return
    void (async () => {
      const res = await fetch('/api/invitations/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Invitation not found')
        return
      }
      setPreview(json)
    })()
  }, [token])

  async function accept() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Accept failed')
      await update?.()
      router.push('/dashboard')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Accept failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 440, margin: '80px auto', padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 650, marginBottom: 8 }}>Invitation</h1>
      {error && <p style={{ color: '#b91c1c', fontSize: 14 }}>{error}</p>}
      {preview && (
        <div style={{ marginTop: 16, fontSize: 14, color: 'var(--text-secondary)' }}>
          <p>
            Join <strong style={{ color: 'var(--text-primary)' }}>{preview.organization?.name}</strong>
            {preview.workspace ? ` / ${preview.workspace.name}` : ''} as {preview.role}.
          </p>
          <p style={{ marginTop: 8 }}>Intended for {preview.email}</p>
          <p style={{ marginTop: 4 }}>Status: {preview.status}</p>
        </div>
      )}

      {status === 'loading' && <p style={{ marginTop: 16 }}>Checking session…</p>}

      {status === 'unauthenticated' && (
        <div style={{ marginTop: 20, display: 'grid', gap: 8 }}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Sign in with the invited email to accept.
          </p>
          <button
            type="button"
            onClick={() => signIn(undefined, { callbackUrl: `/invite/${token}` })}
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius)',
              border: 'none',
              background: 'var(--brand-700)',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            Sign in to accept
          </button>
          <Link href="/login" style={{ fontSize: 13, color: 'var(--brand-700)' }}>
            Go to login
          </Link>
        </div>
      )}

      {session && preview?.status === 'pending' && (
        <button
          type="button"
          disabled={loading}
          onClick={() => void accept()}
          style={{
            marginTop: 20,
            padding: '10px 14px',
            borderRadius: 'var(--radius)',
            border: 'none',
            background: 'var(--brand-700)',
            color: '#fff',
            cursor: loading ? 'wait' : 'pointer',
          }}
        >
          {loading ? 'Accepting…' : 'Accept invitation'}
        </button>
      )}
    </div>
  )
}
