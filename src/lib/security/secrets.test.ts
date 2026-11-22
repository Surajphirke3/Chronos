import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'crypto'
import {
  decryptSecret,
  encryptSecret,
  encryptWorkflowConfigSecrets,
  isEncryptedSecret,
  redactWorkflowConfigSecrets,
  SecretEncryptionError,
} from './secrets'

const ORIGINAL_KEY = process.env.CHRONOS_ENCRYPTION_KEY

describe('secret encryption', () => {
  before(() => {
    process.env.CHRONOS_ENCRYPTION_KEY = randomBytes(32).toString('base64')
  })

  after(() => {
    if (ORIGINAL_KEY === undefined) delete process.env.CHRONOS_ENCRYPTION_KEY
    else process.env.CHRONOS_ENCRYPTION_KEY = ORIGINAL_KEY
  })

  it('round-trips plaintext', () => {
    const encrypted = encryptSecret('super-secret-value')
    assert.equal(isEncryptedSecret(encrypted), true)
    assert.equal(decryptSecret(encrypted), 'super-secret-value')
  })

  it('does not double-encrypt', () => {
    const once = encryptSecret('abc')
    const twice = encryptSecret(once)
    assert.equal(once, twice)
  })

  it('rejects tampered ciphertext', () => {
    const encrypted = encryptSecret('abc')
    const tampered = encrypted.slice(0, -2) + (encrypted.endsWith('ab') ? 'cd' : 'ab')
    assert.throws(() => decryptSecret(tampered), SecretEncryptionError)
  })

  it('returns legacy plaintext unchanged on decrypt', () => {
    assert.equal(decryptSecret('legacy-plain'), 'legacy-plain')
  })

  it('fails encrypt without key', () => {
    const key = process.env.CHRONOS_ENCRYPTION_KEY
    delete process.env.CHRONOS_ENCRYPTION_KEY
    assert.throws(() => encryptSecret('x'), SecretEncryptionError)
    process.env.CHRONOS_ENCRYPTION_KEY = key
  })

  it('encrypts nested workflow secrets', () => {
    const config = encryptWorkflowConfigSecrets({
      smtpPass: 'mail-pass',
      aiApiKey: 'ai-key',
      smtpHost: 'smtp.gmail.com',
    })!
    assert.equal(isEncryptedSecret(config.smtpPass), true)
    assert.equal(isEncryptedSecret(config.aiApiKey), true)
    assert.equal(config.smtpHost, 'smtp.gmail.com')
  })

  it('redacts workflow secrets for clients', () => {
    const redacted = redactWorkflowConfigSecrets({
      smtpPass: 'enc:v1:x:y:z',
      aiApiKey: '',
      smtpUser: 'a@b.com',
    }) as Record<string, unknown>
    assert.equal(redacted.smtpPass, '')
    assert.equal(redacted.smtpPassSet, true)
    assert.equal(redacted.aiApiKeySet, false)
    assert.equal(redacted.smtpUser, 'a@b.com')
  })
})
