import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  assertCheckoutTransition,
  assertPaymentTransition,
  assertSubscriptionTransition,
  canTransitionCheckout,
  canTransitionPayment,
  canTransitionSubscription,
  getCheckoutTransitionTable,
  getPaymentTransitionTable,
  getSubscriptionTransitionTable,
} from './states'
import {
  assertIntegerMinorUnits,
  CHECKOUT_SESSION_STATUSES,
  PAYMENT_STATUSES,
  rupeesToPaise,
  SUBSCRIPTION_STATUSES,
} from '../types'
import { getPlanSeed, PLAN_SEEDS } from '../plans/seed'

describe('subscription state machine', () => {
  it('allows free → checkout_pending and free → trialing', () => {
    assert.equal(canTransitionSubscription('free', 'checkout_pending'), true)
    assert.equal(canTransitionSubscription('free', 'trialing'), true)
    assert.equal(canTransitionSubscription('free', 'active'), false)
  })

  it('allows checkout_pending → active | free | checkout_pending', () => {
    assert.equal(canTransitionSubscription('checkout_pending', 'active'), true)
    assert.equal(canTransitionSubscription('checkout_pending', 'free'), true)
    assert.equal(canTransitionSubscription('checkout_pending', 'checkout_pending'), true)
  })

  it('rejects active → free (must cancel or lapse via defined paths)', () => {
    assert.equal(canTransitionSubscription('active', 'free'), false)
    assert.throws(() => assertSubscriptionTransition('active', 'free'))
  })

  it('covers renewal and cancellation paths', () => {
    assert.equal(canTransitionSubscription('active', 'renewal_pending'), true)
    assert.equal(canTransitionSubscription('renewal_pending', 'past_due'), true)
    assert.equal(canTransitionSubscription('active', 'canceling'), true)
    assert.equal(canTransitionSubscription('canceling', 'free'), true)
  })

  it('defines transitions for every subscription status', () => {
    const table = getSubscriptionTransitionTable()
    for (const status of SUBSCRIPTION_STATUSES) {
      assert.ok(status in table, `missing transitions for ${status}`)
      assert.ok(Array.isArray(table[status]))
    }
  })
})

describe('checkout state machine', () => {
  it('allows created → pending → succeeded', () => {
    assert.equal(canTransitionCheckout('created', 'pending'), true)
    assert.equal(canTransitionCheckout('pending', 'succeeded'), true)
  })

  it('treats succeeded as terminal', () => {
    assert.equal(canTransitionCheckout('succeeded', 'pending'), false)
    assert.throws(() => assertCheckoutTransition('succeeded', 'failed'))
  })

  it('defines transitions for every checkout status', () => {
    const table = getCheckoutTransitionTable()
    for (const status of CHECKOUT_SESSION_STATUSES) {
      assert.ok(status in table)
    }
  })
})

describe('payment state machine', () => {
  it('allows pending → succeeded|failed and refunds from succeeded', () => {
    assert.equal(canTransitionPayment('pending', 'succeeded'), true)
    assert.equal(canTransitionPayment('pending', 'failed'), true)
    assert.equal(canTransitionPayment('succeeded', 'refunded'), true)
    assert.equal(canTransitionPayment('failed', 'succeeded'), false)
    assert.throws(() => assertPaymentTransition('failed', 'succeeded'))
  })

  it('defines transitions for every payment status', () => {
    const table = getPaymentTransitionTable()
    for (const status of PAYMENT_STATUSES) {
      assert.ok(status in table)
    }
  })
})

describe('plan seeds', () => {
  it('includes free through enterprise with INR paise amounts', () => {
    assert.equal(PLAN_SEEDS.length, 5)
    const free = getPlanSeed('free')
    assert.equal(free.priceMonthly, 0)
    assert.equal(free.currency, 'INR')
    assert.ok(free.entitlements['ai.requests'])
    assert.equal(getPlanSeed('starter').priceMonthly, 99_900)
    assert.equal(getPlanSeed('enterprise').isPublic, false)
  })

  it('uses integer minor units for all plans', () => {
    for (const plan of PLAN_SEEDS) {
      assertIntegerMinorUnits(plan.priceMonthly, `${plan.slug}.priceMonthly`)
      assertIntegerMinorUnits(plan.priceYearly, `${plan.slug}.priceYearly`)
    }
    assert.equal(rupeesToPaise(999), 99_900)
  })
})
