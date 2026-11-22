import { Schema, model, models } from 'mongoose'

const InvoiceSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    subscriptionId: { type: Schema.Types.ObjectId, ref: 'Subscription', required: true },
    paymentId: { type: Schema.Types.ObjectId, ref: 'Payment', default: null },
    provider: {
      type: String,
      enum: ['mock_razorpay', 'manual', 'razorpay'],
      required: true,
    },
    providerInvoiceId: { type: String, required: true },
    /** Display reference only — not a GST-compliant tax invoice. */
    invoiceNumber: { type: String, required: true },
    /** Amount in paise. */
    amount: { type: Number, required: true, min: 0 },
    /** No Chronos tax calculation; remains 0 unless provider supplies. */
    taxAmount: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: 'INR' },
    status: {
      type: String,
      enum: ['draft', 'open', 'paid', 'void', 'uncollectible'],
      default: 'open',
    },
    issuedAt: { type: Date, required: true },
    paidAt: { type: Date, default: null },
    invoiceDocumentReference: { type: String, default: '' },
    isSimulated: { type: Boolean, default: false },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
)

InvoiceSchema.index({ provider: 1, providerInvoiceId: 1 }, { unique: true })
InvoiceSchema.index({ organizationId: 1, issuedAt: -1 })
InvoiceSchema.index({ subscriptionId: 1, issuedAt: -1 })

export const Invoice = (models.Invoice || model('Invoice', InvoiceSchema)) as any
