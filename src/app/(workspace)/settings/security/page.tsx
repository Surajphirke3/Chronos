'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

type Policy = {
  allowedInviteEmailDomains: string[]
  allowGuestAccess: boolean
  whoCanInvite: string
  allowApiKeyCreation: boolean
  maxApiKeyLifetimeDays: number
  allowDataExport: boolean
  restrictWorkspaceCreationToAdmins: boolean
  mfa: { status: string }
  version: number
}

export default function SecuritySettingsPage() {
  const [policy, setPolicy] = useState<Policy | null>(null)
  const [domains, setDomains] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/governance/security')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load')
      setPolicy(json.policy)
      setDomains((json.policy.allowedInviteEmailDomains || []).join(', '))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!policy) return
    setMessage(null)
    setError(null)
    const res = await fetch('/api/governance/security', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        allowedInviteEmailDomains: domains
          .split(',')
          .map((d) => d.trim())
          .filter(Boolean),
        allowGuestAccess: policy.allowGuestAccess,
        allowApiKeyCreation: policy.allowApiKeyCreation,
        allowDataExport: policy.allowDataExport,
        maxApiKeyLifetimeDays: policy.maxApiKeyLifetimeDays,
        restrictWorkspaceCreationToAdmins: policy.restrictWorkspaceCreationToAdmins,
        whoCanInvite: policy.whoCanInvite,
      }),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error || 'Save failed')
      return
    }
    setPolicy(json.policy)
    setMessage('Policy saved')
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <Link href="/settings" style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          ← Settings
        </Link>
        <h1 className="text-2xl font-semibold mt-2">Security policies</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Organization security controls. MFA is not supported by the current authentication
          stack and cannot be enabled.
        </p>
      </div>
      {loading && <p>Loading…</p>}
      {error && <p style={{ color: '#b91c1c' }}>{error}</p>}
      {message && <p style={{ color: 'var(--brand-700)' }}>{message}</p>}
      {policy && (
        <form onSubmit={save} className="space-y-4">
          <label className="block text-sm">
            Allowed invite email domains (comma-separated, empty = unrestricted)
            <input
              value={domains}
              onChange={(e) => setDomains(e.target.value)}
              className="mt-1 w-full rounded-md px-3 py-2"
              style={{ border: '1px solid var(--border)' }}
            />
          </label>
          {(
            [
              ['allowGuestAccess', 'Allow guest workspace access'],
              ['allowApiKeyCreation', 'Allow API key creation'],
              ['allowDataExport', 'Allow data export'],
              ['restrictWorkspaceCreationToAdmins', 'Restrict workspace creation to admins'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(policy[key])}
                onChange={(e) => setPolicy({ ...policy, [key]: e.target.checked })}
              />
              {label}
            </label>
          ))}
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            MFA status: <strong>{policy.mfa.status}</strong> (not configurable)
          </p>
          <button type="submit" className="rounded-md px-4 py-2 text-sm" style={{ background: 'var(--brand-600)', color: '#fff' }}>
            Save policy
          </button>
        </form>
      )}
    </div>
  )
}
