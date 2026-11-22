import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { checkRateLimitMemoryOnly, hashIdentifier } from './rateLimit'

describe('checkRateLimitMemoryOnly', () => {
  it('allows requests under the limit', () => {
    const key = `under-${Math.random()}`
    const first = checkRateLimitMemoryOnly(key, 3, 60_000)
    const second = checkRateLimitMemoryOnly(key, 3, 60_000)
    assert.equal(first.allowed, true)
    assert.equal(second.allowed, true)
    assert.equal(second.remaining, 1)
  })

  it('blocks requests over the limit', () => {
    const key = `over-${Math.random()}`
    checkRateLimitMemoryOnly(key, 2, 60_000)
    checkRateLimitMemoryOnly(key, 2, 60_000)
    const blocked = checkRateLimitMemoryOnly(key, 2, 60_000)
    assert.equal(blocked.allowed, false)
    assert.equal(blocked.remaining, 0)
  })

  it('isolates different keys', () => {
    const a = checkRateLimitMemoryOnly(`iso-a-${Math.random()}`, 1, 60_000)
    const b = checkRateLimitMemoryOnly(`iso-b-${Math.random()}`, 1, 60_000)
    assert.equal(a.allowed, true)
    assert.equal(b.allowed, true)
  })
})

describe('hashIdentifier', () => {
  it('normalizes case', () => {
    assert.equal(hashIdentifier('A@B.com'), hashIdentifier('a@b.com'))
  })
})
