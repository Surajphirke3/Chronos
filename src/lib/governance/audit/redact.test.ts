import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { redactValue } from './redact'

describe('audit redaction', () => {
  it('redacts sensitive keys', () => {
    const out = redactValue({
      email: 'a@b.com',
      password: 'secret',
      apiKey: 'sk_live',
      nested: { refreshToken: 'x', ok: 1 },
    }) as Record<string, unknown>
    assert.equal(out.email, 'a@b.com')
    assert.equal(out.password, '[redacted]')
    assert.equal(out.apiKey, '[redacted]')
    assert.equal((out.nested as Record<string, unknown>).refreshToken, '[redacted]')
    assert.equal((out.nested as Record<string, unknown>).ok, 1)
  })
})
