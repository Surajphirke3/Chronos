import { Schema, model, models } from 'mongoose'

const IntegrationConnectionSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', default: null },
    provider: { type: String, required: true },
    status: {
      type: String,
      enum: ['active', 'disconnected', 'error', 'pending'],
      default: 'pending',
    },
    displayName: { type: String, default: '' },
    /** Encrypted credential blob — never return to clients. */
    credentialsEncrypted: { type: String, default: '' },
    scopes: { type: [String], default: [] },
    metadata: { type: Schema.Types.Mixed, default: {} },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    lastHealthCheckAt: { type: Date, default: null },
    lastError: { type: String, default: '' },
  },
  { timestamps: true }
)

IntegrationConnectionSchema.index({ organizationId: 1, provider: 1, status: 1 })
IntegrationConnectionSchema.index({ organizationId: 1, createdAt: -1 })

export const IntegrationConnection =
  (models.IntegrationConnection ||
    model('IntegrationConnection', IntegrationConnectionSchema)) as any
