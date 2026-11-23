import { Schema, model, models } from 'mongoose'

const RateLimitBucketSchema = new Schema(
  {
    _id: { type: String, required: true },
    count: { type: Number, required: true, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false }
)

RateLimitBucketSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export const RateLimitBucket =
  (models.RateLimitBucket || model('RateLimitBucket', RateLimitBucketSchema)) as any
