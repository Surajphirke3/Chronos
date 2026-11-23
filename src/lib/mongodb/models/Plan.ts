import { Schema, model, models } from 'mongoose'

const PlanSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      enum: ['free', 'starter', 'pro', 'business', 'enterprise'],
    },
    description: { type: String, default: '' },
    currency: { type: String, default: 'INR' },
    /** Integer minor units (paise). Placeholder pricing — not final. */
    priceMonthly: { type: Number, required: true, min: 0 },
    priceYearly: { type: Number, required: true, min: 0 },
    billingIntervalOptions: {
      type: [{ type: String, enum: ['month', 'year'] }],
      default: [],
    },
    trialDays: { type: Number, default: 0, min: 0 },
    features: { type: [String], default: [] },
    entitlements: { type: Schema.Types.Mixed, default: {} },
    limits: { type: Schema.Types.Mixed, default: {} },
    isPublic: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
    displayOrder: { type: Number, default: 100 },
    providerPriceReferences: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
)

PlanSchema.index({ slug: 1 }, { unique: true })
PlanSchema.index({ isActive: 1, isPublic: 1, displayOrder: 1 })

export const Plan = (models.Plan || model('Plan', PlanSchema)) as any
