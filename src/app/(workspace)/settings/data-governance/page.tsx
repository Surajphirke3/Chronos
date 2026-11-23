'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

type ExportRow = {
  _id: string
  status: string
  scope: string
  createdAt: string
  expiresAt?: string
  error?: string
}

export default function DataGovernancePage() {
  const [exports, setExports] = useState<ExportRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/governance/exports')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load')
      setExports(json.exports || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function requestExport() {
    setMessage(null)
    setError(null)
    const res = await fetch('/api/governance/exports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope: 'organization' }),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error || 'Export failed')
      return
    }
    setMessage(`Export ${json.export?.status || 'queued'}`)
    await load()
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <Link href="/settings" style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          ← Settings
        </Link>
        <h1 className="text-2xl font-semibold mt-2">Data governance</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Organization-scoped data exports processed via durable jobs when available. Audit
          records are not purged by project cleanup. Requires GOVERNANCE_DATA_EXPORT_ENABLED and
          security policy allowDataExport.
        </p>
      </div>
      {loading && <p>Loading…</p>}
      {error && <p style={{ color: '#b91c1c' }}>{error}</p>}
      {message && <p style={{ color: 'var(--brand-700)' }}>{message}</p>}
      <button
        type="button"
        onClick={() => void requestExport()}
        className="rounded-md px-4 py-2 text-sm"
        style={{ background: 'var(--brand-600)', color: '#fff' }}
      >
        Request organization export
      </button>
      <ul className="space-y-2">
        {exports.map((ex) => (
          <li key={ex._id} className="rounded-lg p-3 text-sm" style={{ border: '1px solid var(--border)' }}>
            <div>
              {ex.status} · {ex.scope}
            </div>
            <div style={{ color: 'var(--text-secondary)' }}>
              {new Date(ex.createdAt).toLocaleString()}
              {ex.error ? ` · ${ex.error}` : ''}
            </div>
          </li>
        ))}
      </ul>
      {!loading && exports.length === 0 && (
        <p style={{ color: 'var(--text-secondary)' }}>No export requests yet.</p>
      )}
    </div>
  )
}
