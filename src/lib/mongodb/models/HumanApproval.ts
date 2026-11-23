import { Schema, model, models } from 'mongoose'

const HumanApprovalSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', default: null },
    initiatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    actionType: { type: String, required: true },
    requiredPermission: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, default: {} },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'expired', 'executed', 'failed'],
      default: 'pending',
    },
    approverId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    expiresAt: { type: Date, required: true },
    decidedAt: { type: Date, default: null },
    executionResult: { type: Schema.Types.Mixed, default: null },
    correlationId: { type: String, default: '' },
  },
  { timestamps: true }
)

HumanApprovalSchema.index({ organizationId: 1, status: 1, createdAt: -1 })
HumanApprovalSchema.index({ expiresAt: 1, status: 1 })

export const HumanApproval =
  (models.HumanApproval || model('HumanApproval', HumanApprovalSchema)) as any
