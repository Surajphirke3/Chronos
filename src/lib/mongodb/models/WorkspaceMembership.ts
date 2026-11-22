import { Schema, model, models } from 'mongoose'

const WorkspaceMembershipSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: {
      type: String,
      enum: ['owner', 'admin', 'member', 'guest'],
      default: 'member',
    },
    status: {
      type: String,
      enum: ['active', 'invited', 'removed'],
      default: 'active',
    },
    joinedAt: { type: Date, default: Date.now },
    invitedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
)

WorkspaceMembershipSchema.index({ workspaceId: 1, userId: 1 }, { unique: true })
WorkspaceMembershipSchema.index({ userId: 1, status: 1 })
WorkspaceMembershipSchema.index({ organizationId: 1, userId: 1, status: 1 })

export const WorkspaceMembership =
  (models.WorkspaceMembership || model('WorkspaceMembership', WorkspaceMembershipSchema)) as any
