import { Schema, model, models } from 'mongoose'

const AiUsageEventSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    provider: { type: String, required: true },
    model: { type: String, default: '' },
    route: { type: String, required: true },
    outcome: { type: String, enum: ['success', 'error', 'rejected'], required: true },
    promptTokens: { type: Number, default: 0 },
    completionTokens: { type: Number, default: 0 },
    day: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

AiUsageEventSchema.index({ userId: 1, day: 1, outcome: 1 })
AiUsageEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 })

export const AiUsageEvent =
  (models.AiUsageEvent || model('AiUsageEvent', AiUsageEventSchema)) as any
