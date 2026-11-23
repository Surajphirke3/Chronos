import { Schema, model, models } from 'mongoose'

const PaymentSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    subscriptionId: { type: Schema.Types.ObjectId, ref: 'Subscription', required: true },
    checkoutSessionId: { type: Schema.Types.ObjectId, ref: 'CheckoutSession', default: null },
    provider: {
      type: String,
      enum: ['mock_razorpay', 'manual', 'razorpay'],
      required: true,
    },
    providerPaymentId: { type: String, required: true },
    /** Amount in paise. */
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    status: {
      type: String,
      enum: ['pending', 'succeeded', 'failed', 'refunded', 'partially_refunded'],
      default: 'pending',
    },
    failureCode: { type: String, default: '' },
    failureMessage: { type: String, default: '' },
    /** Always true for MockRazorpay — never present mock rows as live settlements. */
    isSimulated: { type: Boolean, default: false },
    paidAt: { type: Date, default: null },
    refundedAt: { type: Date, default: null },
    rawProviderStatus: { type: String, default: '' },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
)

PaymentSchema.index({ provider: 1, providerPaymentId: 1 }, { unique: true })
PaymentSchema.index({ organizationId: 1, createdAt: -1 })
PaymentSchema.index({ subscriptionId: 1, createdAt: -1 })

export const Payment = (models.Payment || model('Payment', PaymentSchema)) as any
