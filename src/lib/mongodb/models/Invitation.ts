import { Schema, model, models } from 'mongoose'

const InvitationSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace' },
    email: { type: String, required: true, lowercase: true, trim: true },
    role: {
      type: String,
      enum: ['owner', 'admin', 'member', 'guest'],
      default: 'member',
    },
    scope: {
      type: String,
      enum: ['organization', 'workspace'],
      default: 'workspace',
    },
    tokenHash: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'revoked', 'expired'],
      default: 'pending',
    },
    expiresAt: { type: Date, required: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    acceptedAt: { type: Date },
    acceptedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
)

InvitationSchema.index({ tokenHash: 1 }, { unique: true })
InvitationSchema.index({ organizationId: 1, email: 1, status: 1 })
InvitationSchema.index({ expiresAt: 1 })

export const Invitation = (models.Invitation || model('Invitation', InvitationSchema)) as any
