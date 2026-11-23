import { Schema, model, models } from 'mongoose'

const SubscriptionEventSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    subscriptionId: { type: Schema.Types.ObjectId, ref: 'Subscription', required: true },
    type: { type: String, required: true },
    fromStatus: { type: String, default: '' },
    toStatus: { type: String, default: '' },
    actorUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    providerEventId: { type: String, default: null },
    payload: { type: Schema.Types.Mixed, default: {} },
    correlationId: { type: String, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

SubscriptionEventSchema.index({ organizationId: 1, createdAt: -1 })
SubscriptionEventSchema.index({ subscriptionId: 1, createdAt: -1 })
SubscriptionEventSchema.index({ type: 1, organizationId: 1 })

export const SubscriptionEvent =
  (models.SubscriptionEvent || model('SubscriptionEvent', SubscriptionEventSchema)) as any
