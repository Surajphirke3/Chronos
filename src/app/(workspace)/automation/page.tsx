'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

type Job = {
  _id: string
  jobType: string
  status: string
  attempts: number
  maxAttempts: number
  lastError?: string
  correlationId?: string
  createdAt: string
  availableAt?: string
  completedAt?: string
}

const STATUSES = ['', 'queued', 'scheduled', 'processing', 'retrying', 'completed', 'failed', 'dead_letter', 'cancelled']

export default function AutomationPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({ limit: '40', page: '1' })
      if (status) qs.set('status', status)
      const res = await fetch(`/api/jobs?${qs}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load jobs')
      setJobs(json.jobs || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => {
    void load()
  }, [load])

  async function cancelJob(id: string) {
    setMessage(null)
    const res = await fetch(`/api/jobs/${id}/cancel`, { method: 'POST' })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error || 'Cancel failed')
      return
    }
    setMessage('Job cancelled')
    void load()
  }

  async function retryJob(id: string) {
    setMessage(null)
    const res = await fetch(`/api/jobs/${id}/retry`, { method: 'POST' })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error || 'Retry failed')
      return
    }
    setMessage('Job requeued')
    void load()
  }

  return (
    <div style={{ maxWidth: 960 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 650, marginBottom: 4 }}>Automation</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            Durable job queue for workflows and background AI. Data is live from your workspace.
          </p>
        </div>
        <Link href="/outreach/monitor" style={{ fontSize: 13, color: 'var(--brand-700)' }}>
          Outreach monitor →
        </Link>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Status{' '}
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            style={{
              marginLeft: 6,
              padding: '6px 10px',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border-subtle)',
              background: 'var(--bg-elevated)',
              color: 'var(--text-primary)',
            }}
          >
            {STATUSES.map((s) => (
              <option key={s || 'all'} value={s}>
                {s || 'All'}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => void load()}
          style={{
            padding: '6px 12px',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border-subtle)',
            background: 'var(--bg-elevated)',
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          Refresh
        </button>
      </div>

      {error && <p style={{ color: '#b91c1c', fontSize: 13, marginBottom: 12 }}>{error}</p>}
      {message && <p style={{ color: 'var(--brand-700)', fontSize: 13, marginBottom: 12 }}>{message}</p>}

      {loading ? (
        <p style={{ color: 'var(--text-secondary)' }}>Loading jobs…</p>
      ) : jobs.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          No jobs yet. Execute a workflow to enqueue resume jobs, or POST to /api/jobs.
        </p>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {jobs.map((job) => (
            <div
              key={job._id}
              style={{
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius)',
                padding: '12px 14px',
                background: 'var(--bg-elevated)',
              }}
            >
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontWeight: 560, fontSize: 14 }}>{job.jobType}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                    {job.status} · attempt {job.attempts}/{job.maxAttempts} ·{' '}
                    {new Date(job.createdAt).toLocaleString()}
                  </div>
                  {job.lastError ? (
                    <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 6 }}>{job.lastError}</div>
                  ) : null}
                  {job.correlationId ? (
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                      {job.correlationId}
                    </div>
                  ) : null}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {['queued', 'scheduled', 'retrying', 'processing'].includes(job.status) && (
                    <button type="button" onClick={() => void cancelJob(job._id)} style={btnStyle}>
                      Cancel
                    </button>
                  )}
                  {['failed', 'dead_letter'].includes(job.status) && (
                    <button type="button" onClick={() => void retryJob(job._id)} style={btnStyle}>
                      Retry
                    </button>
                  )}
                  <Link href={`/automation/jobs/${job._id}`} style={{ ...btnStyle, textDecoration: 'none' }}>
                    Details
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 'var(--radius)',
  border: '1px solid var(--border-subtle)',
  background: 'transparent',
  cursor: 'pointer',
  fontSize: 12,
  color: 'var(--text-secondary)',
}
