import { Schema, model, models } from 'mongoose'

const WebhookDeliverySchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    endpointId: { type: Schema.Types.ObjectId, ref: 'WebhookEndpoint', required: true },
    eventType: { type: String, required: true },
    eventId: { type: String, required: true },
    payloadHash: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'delivered', 'failed', 'dead_letter'],
      default: 'pending',
    },
    attempts: { type: Number, default: 0 },
    lastStatusCode: { type: Number, default: null },
    lastError: { type: String, default: '' },
    nextAttemptAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
)

WebhookDeliverySchema.index({ organizationId: 1, createdAt: -1 })
WebhookDeliverySchema.index({ endpointId: 1, eventId: 1 }, { unique: true })
WebhookDeliverySchema.index({ status: 1, nextAttemptAt: 1 })

export const WebhookDelivery =
  (models.WebhookDelivery || model('WebhookDelivery', WebhookDeliverySchema)) as any
