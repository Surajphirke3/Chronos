import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
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

  it('acceptInvitation claims by email atomically (source invariant)', () => {
    const source = readFileSync(join(process.cwd(), 'src/lib/tenancy/invitations.ts'), 'utf8')
    assert.match(source, /findOneAndUpdate\([\s\S]*email[\s\S]*status:\s*'pending'/)
    assert.doesNotMatch(source, /\$set:\s*\{\s*status:\s*'pending'/)
  })
})
