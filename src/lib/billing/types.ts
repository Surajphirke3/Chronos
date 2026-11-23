/** Chronos billing shared types — Checkpoint 1. Amounts are integer minor units (paise for INR). */

export const BILLING_CURRENCY_INR = 'INR' as const

export type BillingProviderId = 'mock_razorpay' | 'manual' | 'none' | 'razorpay'

/** Providers that may appear on customers/payments/invoices (excludes local `none`). */
export type ExternalBillingProvider = 'mock_razorpay' | 'manual' | 'razorpay'

export type BillingInterval = 'month' | 'year' | 'none'

export type PlanSlug = 'free' | 'starter' | 'pro' | 'business' | 'enterprise'

export type SubscriptionStatus =
  | 'free'
  | 'checkout_pending'
  | 'trialing'
  | 'active'
  | 'renewal_pending'
  | 'past_due'
  | 'suspended'
  | 'canceling'
  | 'canceled'
  | 'expired'

export const SUBSCRIPTION_STATUSES: SubscriptionStatus[] = [
  'free',
  'checkout_pending',
  'trialing',
  'active',
  'renewal_pending',
  'past_due',
  'suspended',
  'canceling',
  'canceled',
  'expired',
]

export type CheckoutSessionStatus =
  | 'created'
  | 'pending'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'expired'

export const CHECKOUT_SESSION_STATUSES: CheckoutSessionStatus[] = [
  'created',
  'pending',
  'succeeded',
  'failed',
  'cancelled',
  'expired',
]

export type PaymentStatus =
  | 'pending'
  | 'succeeded'
  | 'failed'
  | 'refunded'
  | 'partially_refunded'

export const PAYMENT_STATUSES: PaymentStatus[] = [
  'pending',
  'succeeded',
  'failed',
  'refunded',
  'partially_refunded',
]

export type InvoiceStatus = 'draft' | 'open' | 'paid' | 'void' | 'uncollectible'

export type BillingProviderEventProcessingStatus =
  | 'received'
  | 'processed'
  | 'ignored'
  | 'failed'

export type EntitlementPeriod = 'none' | 'billing_period' | 'calendar_month'

export type EntitlementUnit = 'count' | 'tokens' | 'bytes' | 'boolean'

export interface EntitlementLimit {
  limit: number
  unit: EntitlementUnit
  period: EntitlementPeriod
}

export type EntitlementMap = Record<string, EntitlementLimit>

/** Convert major units (rupees) to paise. Prefer storing paise directly in seeds. */
export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100)
}

export function paiseToRupees(paise: number): number {
  return paise / 100
}

export function assertIntegerMinorUnits(amount: number, label = 'amount'): void {
  if (!Number.isInteger(amount) || amount < 0) {
    throw new Error(`${label} must be a non-negative integer (minor units)`)
  }
}
