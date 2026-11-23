import { Schema, model, models } from 'mongoose'

const WebhookEndpointSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', default: null },
    name: { type: String, required: true },
    targetUrl: { type: String, required: true },
    /** Hashed signing secret. */
    secretHash: { type: String, required: true },
    secretPrefix: { type: String, required: true },
    events: { type: [String], default: [] },
    status: { type: String, enum: ['active', 'disabled'], default: 'active' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    failureCount: { type: Number, default: 0 },
  },
  { timestamps: true }
)

WebhookEndpointSchema.index({ organizationId: 1, status: 1 })

export const WebhookEndpoint =
  (models.WebhookEndpoint || model('WebhookEndpoint', WebhookEndpointSchema)) as any
