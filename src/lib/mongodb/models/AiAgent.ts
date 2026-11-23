import { Schema, model, models } from 'mongoose'

const AiAgentSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', default: null },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    systemPrompt: { type: String, default: '' },
    allowedTools: { type: [String], default: [] },
    knowledgeBaseIds: [{ type: Schema.Types.ObjectId, ref: 'KnowledgeBase' }],
    requireApprovalFor: { type: [String], default: [] },
    maxSteps: { type: Number, default: 8, min: 1, max: 32 },
    status: { type: String, enum: ['active', 'disabled'], default: 'active' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
)

AiAgentSchema.index({ organizationId: 1, status: 1 })

export const AiAgent = (models.AiAgent || model('AiAgent', AiAgentSchema)) as any
