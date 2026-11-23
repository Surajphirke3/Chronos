'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

type ApiKey = {
  _id: string
  name: string
  keyPrefix: string
  scopes: string[]
  status: string
  createdAt: string
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [name, setName] = useState('')
  const [scopes, setScopes] = useState('audit.read')
  const [secretOnce, setSecretOnce] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/governance/api-keys')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load')
      setKeys(json.apiKeys || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setSecretOnce(null)
    setError(null)
    const res = await fetch('/api/governance/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        scopes: scopes.split(',').map((s) => s.trim()).filter(Boolean),
      }),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error || 'Create failed')
      return
    }
    setSecretOnce(json.secret)
    setName('')
    await load()
  }

  async function revoke(id: string) {
    const res = await fetch(`/api/governance/api-keys/${id}/revoke`, { method: 'POST' })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error || 'Revoke failed')
      return
    }
    await load()
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <Link href="/settings" style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          ← Settings
        </Link>
        <h1 className="text-2xl font-semibold mt-2">API keys</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Organization machine credentials. Secrets are shown once and stored hashed. Requires
          GOVERNANCE_API_KEYS_ENABLED.
        </p>
      </div>
      {loading && <p>Loading…</p>}
      {error && <p style={{ color: '#b91c1c' }}>{error}</p>}
      {secretOnce && (
        <div className="rounded-lg p-3 text-sm" style={{ background: 'var(--surface-2)' }}>
          Copy now — this secret will not be shown again:
          <code className="block mt-2 break-all">{secretOnce}</code>
        </div>
      )}
      <ul className="space-y-2">
        {keys.map((k) => (
          <li
            key={k._id}
            className="flex justify-between gap-2 rounded-lg p-3 text-sm"
            style={{ border: '1px solid var(--border)' }}
          >
            <div>
              <div>{k.name}</div>
              <div style={{ color: 'var(--text-secondary)' }}>
                {k.keyPrefix}… · {k.status} · {k.scopes.join(', ')}
              </div>
            </div>
            {k.status === 'active' && (
              <button type="button" onClick={() => void revoke(k._id)} style={{ color: '#b91c1c' }}>
                Revoke
              </button>
            )}
          </li>
        ))}
      </ul>
      <form onSubmit={create} className="space-y-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Key name"
          required
          className="w-full rounded-md px-3 py-2 text-sm"
          style={{ border: '1px solid var(--border)' }}
        />
        <input
          value={scopes}
          onChange={(e) => setScopes(e.target.value)}
          placeholder="scopes comma-separated"
          className="w-full rounded-md px-3 py-2 text-sm"
          style={{ border: '1px solid var(--border)' }}
        />
        <button type="submit" className="rounded-md px-4 py-2 text-sm" style={{ background: 'var(--brand-600)', color: '#fff' }}>
          Create key
        </button>
      </form>
    </div>
  )
}
