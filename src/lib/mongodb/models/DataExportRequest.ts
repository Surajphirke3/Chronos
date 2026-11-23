import { Schema, model, models } from 'mongoose'

const DataExportRequestSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', default: null },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['queued', 'processing', 'completed', 'failed', 'expired'],
      default: 'queued',
    },
    scope: { type: String, enum: ['organization', 'workspace'], default: 'organization' },
    jobId: { type: Schema.Types.ObjectId, ref: 'Job', default: null },
    artifactPath: { type: String, default: '' },
    downloadTokenHash: { type: String, default: '' },
    expiresAt: { type: Date, default: null },
    error: { type: String, default: '' },
    correlationId: { type: String, default: '' },
  },
  { timestamps: true }
)

DataExportRequestSchema.index({ organizationId: 1, createdAt: -1 })
DataExportRequestSchema.index({ downloadTokenHash: 1 }, { sparse: true })

export const DataExportRequest =
  (models.DataExportRequest || model('DataExportRequest', DataExportRequestSchema)) as any
