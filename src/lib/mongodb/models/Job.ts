import { Schema, model, models } from 'mongoose'

const JobSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
    initiatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    jobType: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, default: {} },
    payloadVersion: { type: Number, default: 1 },
    status: {
      type: String,
      enum: [
        'queued',
        'scheduled',
        'processing',
        'retrying',
        'completed',
        'failed',
        'cancelled',
        'dead_letter',
      ],
      default: 'queued',
    },
    priority: { type: Number, default: 0 },
    idempotencyKey: { type: String },
    correlationId: { type: String, required: true },
    traceId: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 5 },
    availableAt: { type: Date, default: Date.now },
    startedAt: { type: Date },
    completedAt: { type: Date },
    failedAt: { type: Date },
    lockedAt: { type: Date },
    lockedBy: { type: String },
    leaseExpiresAt: { type: Date },
    heartbeatAt: { type: Date },
    lastError: { type: String, default: '' },
    result: { type: Schema.Types.Mixed },
    errorClass: { type: String, enum: ['transient', 'permanent'] },
  },
  { timestamps: true }
)

JobSchema.index({ status: 1, availableAt: 1, priority: -1 })
JobSchema.index({ organizationId: 1, workspaceId: 1, createdAt: -1 })
JobSchema.index(
  { organizationId: 1, workspaceId: 1, jobType: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } }
)
JobSchema.index({ status: 1, leaseExpiresAt: 1 })
JobSchema.index({ correlationId: 1 })
JobSchema.index({ workspaceId: 1, status: 1, updatedAt: -1 })

export const Job = (models.Job || model('Job', JobSchema)) as any
