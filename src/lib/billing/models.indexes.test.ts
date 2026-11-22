import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Plan } from '@/lib/mongodb/models/Plan'
import { Subscription } from '@/lib/mongodb/models/Subscription'
import { BillingCustomer } from '@/lib/mongodb/models/BillingCustomer'
import { CheckoutSession } from '@/lib/mongodb/models/CheckoutSession'
import { Payment } from '@/lib/mongodb/models/Payment'
import { Invoice } from '@/lib/mongodb/models/Invoice'
import { BillingProviderEvent } from '@/lib/mongodb/models/BillingProviderEvent'
import { SubscriptionEvent } from '@/lib/mongodb/models/SubscriptionEvent'

function indexKeys(model: { schema: { indexes: () => Array<[Record<string, number>, Record<string, unknown>?]> } }) {
  return model.schema.indexes().map(([keys]) => keys)
}

function hasIndex(
  model: { schema: { indexes: () => Array<[Record<string, number>, Record<string, unknown>?]> } },
  expected: Record<string, number>
) {
  return indexKeys(model).some((keys) => {
    const a = Object.entries(keys).sort().join(',')
    const b = Object.entries(expected).sort().join(',')
    return a === b
  })
}

describe('billing model indexes', () => {
  it('Plan has unique slug', () => {
    assert.ok(hasIndex(Plan, { slug: 1 }))
  })

  it('Subscription has unique organizationId', () => {
    assert.ok(hasIndex(Subscription, { organizationId: 1 }))
  })

  it('BillingCustomer unique per org+provider', () => {
    assert.ok(hasIndex(BillingCustomer, { organizationId: 1, provider: 1 }))
  })

  it('CheckoutSession unique providerSessionId', () => {
    assert.ok(hasIndex(CheckoutSession, { providerSessionId: 1 }))
  })

  it('Payment unique provider+payment id', () => {
    assert.ok(hasIndex(Payment, { provider: 1, providerPaymentId: 1 }))
  })

  it('Invoice unique provider+invoice id', () => {
    assert.ok(hasIndex(Invoice, { provider: 1, providerInvoiceId: 1 }))
  })

  it('BillingProviderEvent unique provider+event id', () => {
    assert.ok(hasIndex(BillingProviderEvent, { provider: 1, providerEventId: 1 }))
  })

  it('SubscriptionEvent has org and subscription history indexes', () => {
    assert.ok(hasIndex(SubscriptionEvent, { organizationId: 1, createdAt: -1 }))
    assert.ok(hasIndex(SubscriptionEvent, { subscriptionId: 1, createdAt: -1 }))
  })
})
