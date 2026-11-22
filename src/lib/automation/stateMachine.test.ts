import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { canTransition, assertTransition } from './stateMachine'
import { classifyError, computeBackoffMs } from './retry'
import { AutomationError } from './types'

describe('job state machine', () => {
  it('allows queued → processing', () => {
    assert.equal(canTransition('queued', 'processing'), true)
  })

  it('rejects completed → processing', () => {
    assert.equal(canTransition('completed', 'processing'), false)
    assert.throws(() => assertTransition('completed', 'processing'))
  })

  it('allows dead_letter → queued for manual retry', () => {
    assert.equal(canTransition('dead_letter', 'queued'), true)
  })
})

describe('retry classification', () => {
  it('classifies AutomationError explicitly', () => {
    assert.equal(classifyError(new AutomationError('x', 'permanent')), 'permanent')
    assert.equal(classifyError(new AutomationError('x', 'transient')), 'transient')
  })

  it('treats auth messages as permanent', () => {
    assert.equal(classifyError(new Error('Forbidden')), 'permanent')
  })

  it('treats timeouts as transient', () => {
    assert.equal(classifyError(new Error('AI timeout')), 'transient')
  })

  it('backoff is bounded and non-negative', () => {
    const a = computeBackoffMs(1)
    const b = computeBackoffMs(10)
    assert.ok(a >= 0)
    assert.ok(b >= 0)
    assert.ok(b <= 15 * 60 * 1000)
  })
})
