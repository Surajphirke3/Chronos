'use client'

export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div style={{ padding: '48px 24px', maxWidth: 560 }}>
      <h2 style={{ marginBottom: 8 }}>Something went wrong</h2>
      <p style={{ color: 'var(--text-tertiary)', marginBottom: 20, fontSize: 14 }}>
        An unexpected error occurred in the workspace. You can try again without leaving Chronos.
      </p>
      <button className="btn-primary" type="button" onClick={() => reset()}>
        Try again
      </button>
      {error?.digest ? (
        <p style={{ marginTop: 16, fontSize: 12, color: 'var(--text-tertiary)' }}>
          Reference: {error.digest}
        </p>
      ) : null}
    </div>
  )
}
