import { Schema, model, models } from 'mongoose'

const AuditEventSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', default: null },
    actorUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    actorType: {
      type: String,
      enum: ['user', 'api_key', 'system', 'worker', 'platform'],
      default: 'user',
    },
    actorApiKeyId: { type: Schema.Types.ObjectId, ref: 'ApiKey', default: null },
    action: { type: String, required: true },
    resourceType: { type: String, required: true },
    resourceId: { type: String, default: null },
    outcome: { type: String, enum: ['success', 'failure', 'denied'], default: 'success' },
    correlationId: { type: String, default: '' },
    requestId: { type: String, default: '' },
    ipHash: { type: String, default: '' },
    userAgent: { type: String, default: '' },
    before: { type: Schema.Types.Mixed, default: null },
    after: { type: Schema.Types.Mixed, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
    source: {
      type: String,
      enum: ['web', 'api', 'worker', 'system', 'platform'],
      default: 'web',
    },
    schemaVersion: { type: Number, default: 1 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

AuditEventSchema.index({ organizationId: 1, createdAt: -1 })
AuditEventSchema.index({ organizationId: 1, action: 1, createdAt: -1 })
AuditEventSchema.index({ organizationId: 1, actorUserId: 1, createdAt: -1 })
AuditEventSchema.index({ organizationId: 1, resourceType: 1, resourceId: 1 })

export const AuditEvent = (models.AuditEvent || model('AuditEvent', AuditEventSchema)) as any
