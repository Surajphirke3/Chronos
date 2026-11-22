import { Schema, model, models } from 'mongoose'

/**
 * Optional workspace subgroup schema (foundation only).
 * No elaborate team UI/permission engine in Phase 2.
 */
const TeamSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    memberIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['active', 'archived'], default: 'active' },
  },
  { timestamps: true }
)

TeamSchema.index({ workspaceId: 1, name: 1 })

export const Team = (models.Team || model('Team', TeamSchema)) as any
