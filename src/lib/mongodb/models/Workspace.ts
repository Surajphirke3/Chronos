import { Schema, model, models } from 'mongoose'

const WorkspaceSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true },
    description: { type: String, default: '' },
    type: {
      type: String,
      enum: ['general', 'engineering', 'operations', 'marketing', 'sales', 'client'],
      default: 'general',
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    settings: { type: Schema.Types.Mixed, default: {} },
    isDefault: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['active', 'archived'],
      default: 'active',
    },
    migrationKey: { type: String, default: null },
  },
  { timestamps: true }
)

WorkspaceSchema.index({ organizationId: 1, slug: 1 }, { unique: true })
WorkspaceSchema.index({ organizationId: 1, status: 1 })
WorkspaceSchema.index({ migrationKey: 1 }, { unique: true, sparse: true })

export const Workspace = (models.Workspace || model('Workspace', WorkspaceSchema)) as any
