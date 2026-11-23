const SENSITIVE_KEY =
  /(password|secret|token|authorization|api[_-]?key|refresh|card|cvv|ssn|cookie|private)/i

export function redactValue(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[truncated]'
  if (value == null) return value
  if (typeof value === 'string') {
    if (value.length > 500) return `${value.slice(0, 120)}…[truncated]`
    return value
  }
  if (typeof value !== 'object') return value
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redactValue(v, depth + 1))
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEY.test(k)) {
      out[k] = '[redacted]'
      continue
    }
    out[k] = redactValue(v, depth + 1)
  }
  return out
}
