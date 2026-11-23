import { Schema, model, models } from 'mongoose'

const MembershipSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: {
      type: String,
      enum: ['owner', 'admin', 'member'],
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

MembershipSchema.index({ organizationId: 1, userId: 1 }, { unique: true })
MembershipSchema.index({ userId: 1, status: 1 })
MembershipSchema.index({ organizationId: 1, status: 1, role: 1 })

export const Membership = (models.Membership || model('Membership', MembershipSchema)) as any
