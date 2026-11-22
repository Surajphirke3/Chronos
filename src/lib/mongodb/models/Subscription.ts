import { Schema, model, models } from 'mongoose'

const SubscriptionSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    planId: { type: Schema.Types.ObjectId, ref: 'Plan', required: true },
    planSlug: {
      type: String,
      required: true,
      enum: ['free', 'starter', 'pro', 'business', 'enterprise'],
    },
    status: {
      type: String,
      enum: [
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
      ],
      default: 'free',
      required: true,
    },
    provider: {
      type: String,
      enum: ['mock_razorpay', 'manual', 'none', 'razorpay'],
      default: 'none',
    },
    providerCustomerId: { type: String, default: null },
    providerSubscriptionId: { type: String, default: null },
    billingInterval: {
      type: String,
      enum: ['month', 'year', 'none'],
      default: 'none',
    },
    currency: { type: String, default: 'INR' },
    /** Paise charged per interval; 0 for free. */
    unitAmount: { type: Number, default: 0, min: 0 },
    currentPeriodStart: { type: Date, required: true },
    currentPeriodEnd: { type: Date, required: true },
    trialStart: { type: Date, default: null },
    trialEnd: { type: Date, default: null },
    cancelAtPeriodEnd: { type: Boolean, default: false },
    cancelledAt: { type: Date, default: null },
    gracePeriodEnd: { type: Date, default: null },
    checkoutSessionId: { type: Schema.Types.ObjectId, ref: 'CheckoutSession', default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
)

SubscriptionSchema.index({ organizationId: 1 }, { unique: true })
SubscriptionSchema.index(
  { providerSubscriptionId: 1 },
  {
    unique: true,
    sparse: true,
    partialFilterExpression: { providerSubscriptionId: { $type: 'string' } },
  }
)
SubscriptionSchema.index({ status: 1, currentPeriodEnd: 1 })
SubscriptionSchema.index({ planSlug: 1, status: 1 })

export const Subscription =
  (models.Subscription || model('Subscription', SubscriptionSchema)) as any
