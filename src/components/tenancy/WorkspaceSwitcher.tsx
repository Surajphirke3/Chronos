'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Check, ChevronsUpDown, Plus } from 'lucide-react'

type WorkspaceRow = {
  _id: string
  name: string
  slug: string
  organizationId: string
  role?: string
  organization?: { _id: string; name: string; slug: string } | null
}

type ContextState = {
  organizationId: string | null
  workspaceId: string | null
  organization: { name: string; slug: string } | null
  workspace: { name: string; slug: string } | null
}

export default function WorkspaceSwitcher({ collapsed = false }: { collapsed?: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [switching, setSwitching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [context, setContext] = useState<ContextState | null>(null)
  const [workspaces, setWorkspaces] = useState<WorkspaceRow[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [ctxRes, wsRes] = await Promise.all([
        fetch('/api/context'),
        fetch('/api/workspaces'),
      ])
      if (ctxRes.status === 401) return
      const ctxJson = await ctxRes.json()
      const wsJson = await wsRes.json()
      if (!ctxRes.ok) throw new Error(ctxJson.error || 'Failed to load context')
      if (!wsRes.ok) throw new Error(wsJson.error || 'Failed to load workspaces')
      setContext({
        organizationId: ctxJson.organizationId,
        workspaceId: ctxJson.workspaceId,
        organization: ctxJson.organization,
        workspace: ctxJson.workspace,
      })
      setWorkspaces(wsJson.workspaces || [])
      if (!ctxJson.organizationId) {
        // No org yet — send to onboarding
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function switchWorkspace(workspaceId: string) {
    if (switching || workspaceId === context?.workspaceId) {
      setOpen(false)
      return
    }
    setSwitching(true)
    setError(null)
    try {
      const res = await fetch('/api/context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Switch failed')
      setContext({
        organizationId: json.organizationId,
        workspaceId: json.workspaceId,
        organization: json.organization,
        workspace: json.workspace,
      })
      setOpen(false)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Switch failed')
    } finally {
      setSwitching(false)
    }
  }

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={context?.workspace?.name || 'Workspace'}
        style={{
          margin: '8px',
          width: 'calc(100% - 16px)',
          height: 36,
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border-subtle)',
          background: 'var(--bg-base)',
          color: 'var(--text-secondary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <Building2 size={16} />
      </button>
    )
  }

  const grouped = workspaces.reduce<Record<string, WorkspaceRow[]>>((acc, ws) => {
    const key = ws.organization?.name || 'Organization'
    if (!acc[key]) acc[key] = []
    acc[key].push(ws)
    return acc
  }, {})

  return (
    <div style={{ position: 'relative', padding: '8px 8px 0' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 10px',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border-subtle)',
          background: 'var(--bg-base)',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <Building2 size={15} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-tertiary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {loading ? 'Loading…' : context?.organization?.name || 'No organization'}
          </div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--text-primary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {context?.workspace?.name || 'Select workspace'}
          </div>
        </div>
        <ChevronsUpDown size={14} style={{ color: 'var(--text-tertiary)' }} />
      </button>

      {open && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            left: 8,
            right: 8,
            top: '100%',
            marginTop: 4,
            zIndex: 50,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            maxHeight: 320,
            overflowY: 'auto',
          }}
        >
          {error && (
            <div style={{ padding: 10, fontSize: 12, color: 'var(--danger, #b91c1c)' }}>{error}</div>
          )}
          {Object.keys(grouped).length === 0 && !loading && (
            <div style={{ padding: 12, fontSize: 13, color: 'var(--text-secondary)' }}>
              No workspaces yet.
            </div>
          )}
          {Object.entries(grouped).map(([orgName, rows]) => (
            <div key={orgName}>
              <div
                style={{
                  padding: '8px 12px 4px',
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: 'var(--text-tertiary)',
                }}
              >
                {orgName}
              </div>
              {rows.map((ws) => {
                const active = ws._id === context?.workspaceId
                return (
                  <button
                    key={ws._id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    disabled={switching}
                    onClick={() => void switchWorkspace(ws._id)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 12px',
                      border: 'none',
                      background: active ? 'var(--brand-50)' : 'transparent',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      fontSize: 13,
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ flex: 1 }}>{ws.name}</span>
                    {active && <Check size={14} style={{ color: 'var(--brand-700)' }} />}
                  </button>
                )
              })}
            </div>
          ))}
          <div style={{ borderTop: '1px solid var(--border-subtle)', padding: 6 }}>
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                router.push('/onboarding')
              }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 10px',
                border: 'none',
                background: 'transparent',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: 13,
                borderRadius: 'var(--radius)',
              }}
            >
              <Plus size={14} />
              Create organization
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                router.push('/settings/organization')
              }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 10px',
                border: 'none',
                background: 'transparent',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: 13,
                borderRadius: 'var(--radius)',
              }}
            >
              Organization settings
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
