import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { generateWebhookSecret, signWebhookPayload, verifyWebhookSignature } from './signing'

describe('webhook signing', () => {
  it('round-trips signatures within skew', () => {
    const { raw } = generateWebhookSecret()
    const body = JSON.stringify({ hello: 'world' })
    const header = signWebhookPayload(raw, body)
    assert.equal(verifyWebhookSignature(raw, body, header), true)
    assert.equal(verifyWebhookSignature(raw, body + 'x', header), false)
  })
})
