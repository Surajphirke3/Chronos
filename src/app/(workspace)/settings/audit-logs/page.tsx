'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

type AuditEvent = {
  _id: string
  action: string
  resourceType: string
  resourceId?: string
  outcome: string
  actorUserId?: string
  createdAt: string
  correlationId?: string
  metadata?: Record<string, unknown>
}

export default function AuditLogsPage() {
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [action, setAction] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<AuditEvent | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({ limit: '50' })
      if (action) qs.set('action', action)
      const res = await fetch(`/api/governance/audit?${qs}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load audit events')
      setEvents(json.events || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [action])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <Link href="/settings" style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          ← Settings
        </Link>
        <h1 className="text-2xl font-semibold mt-2" style={{ color: 'var(--text-primary)' }}>
          Audit logs
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Organization-scoped immutable security and governance events. Sensitive fields are
          redacted.
        </p>
      </div>

      <div className="flex gap-2">
        <input
          value={action}
          onChange={(e) => setAction(e.target.value)}
          placeholder="Filter by action"
          className="rounded-md px-3 py-2 text-sm flex-1"
          style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
        />
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-md px-4 py-2 text-sm"
          style={{ background: 'var(--brand-600)', color: '#fff' }}
        >
          Refresh
        </button>
      </div>

      {loading && <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>}
      {error && <p style={{ color: 'var(--danger, #b91c1c)' }}>{error}</p>}
      {!loading && !error && events.length === 0 && (
        <p style={{ color: 'var(--text-secondary)' }}>No audit events yet.</p>
      )}

      <ul className="space-y-2">
        {events.map((ev) => (
          <li key={ev._id}>
            <button
              type="button"
              onClick={() => setSelected(ev)}
              className="w-full text-left rounded-lg p-3"
              style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
            >
              <div className="flex justify-between gap-2 text-sm">
                <span style={{ color: 'var(--text-primary)' }}>{ev.action}</span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  {new Date(ev.createdAt).toLocaleString()}
                </span>
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                {ev.resourceType}
                {ev.resourceId ? ` · ${ev.resourceId}` : ''} · {ev.outcome}
              </div>
            </button>
          </li>
        ))}
      </ul>

      {selected && (
        <div
          className="rounded-lg p-4 text-sm space-y-2"
          style={{ border: '1px solid var(--border)', background: 'var(--surface-2)' }}
        >
          <div className="flex justify-between">
            <strong style={{ color: 'var(--text-primary)' }}>Event detail</strong>
            <button type="button" onClick={() => setSelected(null)} className="text-xs">
              Close
            </button>
          </div>
          <pre
            className="overflow-auto text-xs p-2 rounded"
            style={{ background: 'var(--surface)', color: 'var(--text-secondary)' }}
          >
            {JSON.stringify(selected, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
