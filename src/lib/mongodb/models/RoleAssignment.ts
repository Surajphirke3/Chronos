import { Schema, model, models } from 'mongoose'

const RoleAssignmentSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    roleId: { type: Schema.Types.ObjectId, ref: 'OrganizationRole', required: true },
    assignedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['active', 'revoked'], default: 'active' },
    revokedAt: { type: Date, default: null },
    revokedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
)

RoleAssignmentSchema.index(
  { organizationId: 1, userId: 1, roleId: 1 },
  { unique: true }
)
RoleAssignmentSchema.index({ organizationId: 1, userId: 1, status: 1 })
RoleAssignmentSchema.index({ roleId: 1, status: 1 })

export const RoleAssignment =
  (models.RoleAssignment || model('RoleAssignment', RoleAssignmentSchema)) as any
