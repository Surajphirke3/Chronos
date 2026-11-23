import { Schema, model, models } from 'mongoose'

const BillingCustomerSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    provider: {
      type: String,
      enum: ['mock_razorpay', 'manual', 'razorpay'],
      required: true,
    },
    providerCustomerId: { type: String, required: true },
    email: { type: String, default: '' },
    name: { type: String, default: '' },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
)

BillingCustomerSchema.index({ organizationId: 1, provider: 1 }, { unique: true })
BillingCustomerSchema.index(
  { provider: 1, providerCustomerId: 1 },
  { unique: true, sparse: true }
)

export const BillingCustomer =
  (models.BillingCustomer || model('BillingCustomer', BillingCustomerSchema)) as any
