import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { generateApiKeySecret, hashApiKeySecret, verifyApiKeySecret } from './crypto'

describe('api key crypto', () => {
  it('generates chronos_ secrets and verifies hashes', () => {
    const { raw, prefix, hash } = generateApiKeySecret()
    assert.ok(raw.startsWith('chronos_'))
    assert.equal(prefix, raw.slice(0, 16))
    assert.equal(hashApiKeySecret(raw), hash)
    assert.equal(verifyApiKeySecret(raw, hash), true)
    assert.equal(verifyApiKeySecret(raw + 'x', hash), false)
  })
})
