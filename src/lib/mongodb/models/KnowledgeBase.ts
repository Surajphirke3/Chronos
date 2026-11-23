import { Schema, model, models } from 'mongoose'

const KnowledgeBaseSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', default: null },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    status: { type: String, enum: ['active', 'archived'], default: 'active' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
)

KnowledgeBaseSchema.index({ organizationId: 1, status: 1, name: 1 })

export const KnowledgeBase =
  (models.KnowledgeBase || model('KnowledgeBase', KnowledgeBaseSchema)) as any
