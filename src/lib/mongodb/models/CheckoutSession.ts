import { Schema, model, models } from 'mongoose'

const CheckoutSessionSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    initiatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    planId: { type: Schema.Types.ObjectId, ref: 'Plan', required: true },
    planSlug: {
      type: String,
      required: true,
      enum: ['free', 'starter', 'pro', 'business', 'enterprise'],
    },
    billingInterval: { type: String, enum: ['month', 'year'], required: true },
    currency: { type: String, default: 'INR' },
    /** Amount in paise. */
    amount: { type: Number, required: true, min: 0 },
    provider: {
      type: String,
      enum: ['mock_razorpay', 'manual', 'razorpay'],
      default: 'mock_razorpay',
    },
    providerSessionId: { type: String, required: true },
    status: {
      type: String,
      enum: ['created', 'pending', 'succeeded', 'failed', 'cancelled', 'expired'],
      default: 'created',
    },
    subscriptionId: { type: Schema.Types.ObjectId, ref: 'Subscription', required: true },
    successPath: { type: String, default: '/settings/billing' },
    cancelPath: { type: String, default: '/settings/billing' },
    expiresAt: { type: Date, required: true },
    completedAt: { type: Date, default: null },
    failureReason: { type: String, default: '' },
    /** Mock UI hints only — never trust client-supplied simulation outcomes. */
    simulation: { type: Schema.Types.Mixed, default: {} },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
)

CheckoutSessionSchema.index({ providerSessionId: 1 }, { unique: true })
CheckoutSessionSchema.index({ organizationId: 1, status: 1, createdAt: -1 })
CheckoutSessionSchema.index({ status: 1, expiresAt: 1 })

export const CheckoutSession =
  (models.CheckoutSession || model('CheckoutSession', CheckoutSessionSchema)) as any
