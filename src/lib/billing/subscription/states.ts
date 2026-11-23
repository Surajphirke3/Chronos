import type { CheckoutSessionStatus, PaymentStatus, SubscriptionStatus } from '../types'

const SUBSCRIPTION_TRANSITIONS: Record<SubscriptionStatus, SubscriptionStatus[]> = {
  free: ['checkout_pending', 'trialing'],
  checkout_pending: ['active', 'free', 'checkout_pending'],
  trialing: ['active', 'free', 'canceling'],
  active: ['renewal_pending', 'canceling', 'checkout_pending', 'past_due'],
  renewal_pending: ['active', 'past_due'],
  past_due: ['active', 'suspended', 'free'],
  suspended: ['active', 'free', 'canceled'],
  canceling: ['free', 'active'],
  canceled: ['free', 'checkout_pending'],
  expired: ['free', 'checkout_pending'],
}

const CHECKOUT_TRANSITIONS: Record<CheckoutSessionStatus, CheckoutSessionStatus[]> = {
  created: ['pending', 'expired', 'cancelled'],
  pending: ['succeeded', 'failed', 'cancelled', 'expired'],
  succeeded: [],
  failed: [],
  cancelled: [],
  expired: [],
}

const PAYMENT_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  pending: ['succeeded', 'failed'],
  succeeded: ['refunded', 'partially_refunded'],
  failed: [],
  refunded: [],
  partially_refunded: ['refunded'],
}

export function canTransitionSubscription(
  from: SubscriptionStatus,
  to: SubscriptionStatus
): boolean {
  return SUBSCRIPTION_TRANSITIONS[from]?.includes(to) ?? false
}

export function assertSubscriptionTransition(
  from: SubscriptionStatus,
  to: SubscriptionStatus
): void {
  if (!canTransitionSubscription(from, to)) {
    throw new Error(`Invalid subscription transition: ${from} → ${to}`)
  }
}

export function canTransitionCheckout(
  from: CheckoutSessionStatus,
  to: CheckoutSessionStatus
): boolean {
  return CHECKOUT_TRANSITIONS[from]?.includes(to) ?? false
}

export function assertCheckoutTransition(
  from: CheckoutSessionStatus,
  to: CheckoutSessionStatus
): void {
  if (!canTransitionCheckout(from, to)) {
    throw new Error(`Invalid checkout transition: ${from} → ${to}`)
  }
}

export function canTransitionPayment(from: PaymentStatus, to: PaymentStatus): boolean {
  return PAYMENT_TRANSITIONS[from]?.includes(to) ?? false
}

export function assertPaymentTransition(from: PaymentStatus, to: PaymentStatus): void {
  if (!canTransitionPayment(from, to)) {
    throw new Error(`Invalid payment transition: ${from} → ${to}`)
  }
}

export function getSubscriptionTransitionTable(): Record<
  SubscriptionStatus,
  SubscriptionStatus[]
> {
  return structuredClone(SUBSCRIPTION_TRANSITIONS)
}

export function getCheckoutTransitionTable(): Record<
  CheckoutSessionStatus,
  CheckoutSessionStatus[]
> {
  return structuredClone(CHECKOUT_TRANSITIONS)
}

export function getPaymentTransitionTable(): Record<PaymentStatus, PaymentStatus[]> {
  return structuredClone(PAYMENT_TRANSITIONS)
}
