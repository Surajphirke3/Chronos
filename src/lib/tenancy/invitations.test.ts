import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { generateInviteToken, hashInviteToken } from './invitations'

describe('invitation tokens', () => {
  it('generates unique tokens and stores only hashes', () => {
    const a = generateInviteToken()
    const b = generateInviteToken()
    assert.notEqual(a.token, b.token)
    assert.equal(a.tokenHash, hashInviteToken(a.token))
    assert.notEqual(a.token, a.tokenHash)
    assert.equal(a.tokenHash.length, 64)
  })

  it('hash is deterministic', () => {
    assert.equal(hashInviteToken('abc'), hashInviteToken('abc'))
    assert.notEqual(hashInviteToken('abc'), hashInviteToken('abd'))
  })
})
