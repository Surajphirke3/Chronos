import { Schema, model, models } from 'mongoose'

const BillingProviderEventSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', default: null },
    provider: {
      type: String,
      enum: ['mock_razorpay', 'manual', 'razorpay'],
      required: true,
    },
    providerEventId: { type: String, required: true },
    type: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, default: {} },
    processingStatus: {
      type: String,
      enum: ['received', 'processed', 'ignored', 'failed'],
      default: 'received',
    },
    processingError: { type: String, default: '' },
    processedAt: { type: Date, default: null },
    correlationId: { type: String, default: '' },
    isSimulated: { type: Boolean, default: false },
  },
  { timestamps: true }
)

BillingProviderEventSchema.index({ provider: 1, providerEventId: 1 }, { unique: true })
BillingProviderEventSchema.index({ processingStatus: 1, createdAt: 1 })
BillingProviderEventSchema.index({ organizationId: 1, createdAt: -1 })

export const BillingProviderEvent =
  (models.BillingProviderEvent ||
    model('BillingProviderEvent', BillingProviderEventSchema)) as any
