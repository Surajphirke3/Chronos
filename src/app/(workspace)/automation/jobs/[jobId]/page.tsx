'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

export default function JobDetailPage() {
  const params = useParams<{ jobId: string }>()
  const jobId = params?.jobId
  const [job, setJob] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!jobId) return
    void (async () => {
      const res = await fetch(`/api/jobs/${jobId}`)
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Not found')
        return
      }
      setJob(json.job)
    })()
  }, [jobId])

  if (error) {
    return (
      <div>
        <Link href="/automation" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          ← Automation
        </Link>
        <p style={{ color: '#b91c1c', marginTop: 16 }}>{error}</p>
      </div>
    )
  }

  if (!job) return <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>

  const safePayload = { ...(job.payload as object) }

  return (
    <div style={{ maxWidth: 720 }}>
      <Link href="/automation" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        ← Automation
      </Link>
      <h1 style={{ fontSize: 20, fontWeight: 650, marginTop: 12, marginBottom: 8 }}>Job detail</h1>
      <dl style={{ display: 'grid', gap: 10, fontSize: 13 }}>
        <div>
          <dt style={{ color: 'var(--text-tertiary)' }}>Type</dt>
          <dd>{String(job.jobType)}</dd>
        </div>
        <div>
          <dt style={{ color: 'var(--text-tertiary)' }}>Status</dt>
          <dd>{String(job.status)}</dd>
        </div>
        <div>
          <dt style={{ color: 'var(--text-tertiary)' }}>Attempts</dt>
          <dd>
            {String(job.attempts)} / {String(job.maxAttempts)}
          </dd>
        </div>
        <div>
          <dt style={{ color: 'var(--text-tertiary)' }}>Correlation</dt>
          <dd style={{ wordBreak: 'break-all' }}>{String(job.correlationId || '')}</dd>
        </div>
        {job.lastError ? (
          <div>
            <dt style={{ color: 'var(--text-tertiary)' }}>Last error</dt>
            <dd style={{ color: '#b91c1c' }}>{String(job.lastError)}</dd>
          </div>
        ) : null}
        <div>
          <dt style={{ color: 'var(--text-tertiary)' }}>Payload</dt>
          <dd>
            <pre
              style={{
                margin: 0,
                padding: 12,
                background: 'var(--bg-base)',
                borderRadius: 'var(--radius)',
                overflow: 'auto',
                fontSize: 12,
              }}
            >
              {JSON.stringify(safePayload, null, 2)}
            </pre>
          </dd>
        </div>
        {job.result ? (
          <div>
            <dt style={{ color: 'var(--text-tertiary)' }}>Result</dt>
            <dd>
              <pre
                style={{
                  margin: 0,
                  padding: 12,
                  background: 'var(--bg-base)',
                  borderRadius: 'var(--radius)',
                  overflow: 'auto',
                  fontSize: 12,
                }}
              >
                {JSON.stringify(job.result, null, 2)}
              </pre>
            </dd>
          </div>
        ) : null}
      </dl>
    </div>
  )
}
