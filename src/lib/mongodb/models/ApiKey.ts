import { Schema, model, models } from 'mongoose'

const ApiKeySchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', default: null },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    keyPrefix: { type: String, required: true },
    secretHash: { type: String, required: true },
    scopes: { type: [String], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['active', 'revoked', 'expired'], default: 'active' },
    expiresAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
    revokedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    lastUsedAt: { type: Date, default: null },
    lastUsedBucket: { type: String, default: '' },
  },
  { timestamps: true }
)

ApiKeySchema.index({ organizationId: 1, status: 1, createdAt: -1 })
ApiKeySchema.index({ keyPrefix: 1 })
ApiKeySchema.index({ secretHash: 1 }, { unique: true })

export const ApiKey = (models.ApiKey || model('ApiKey', ApiKeySchema)) as any
