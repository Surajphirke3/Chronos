'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

type Org = { _id: string; name: string; slug: string; status: string; createdAt: string }

export default function PlatformAdminPage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/platform/organizations')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Forbidden or failed')
      setOrgs(json.organizations || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <Link href="/settings" style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          ← Settings
        </Link>
        <h1 className="text-2xl font-semibold mt-2">Platform administration</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Restricted to User.platformRole = platform_admin. Organization roles never grant this
          access. List actions are audited.
        </p>
      </div>
      {loading && <p>Loading…</p>}
      {error && <p style={{ color: '#b91c1c' }}>{error}</p>}
      <ul className="space-y-2">
        {orgs.map((o) => (
          <li key={o._id} className="rounded-lg p-3 text-sm" style={{ border: '1px solid var(--border)' }}>
            <strong>{o.name}</strong> ({o.slug}) · {o.status}
          </li>
        ))}
      </ul>
    </div>
  )
}
