import { Schema, model, models } from 'mongoose'

const KnowledgeChunkSchema = new Schema(
  {
    index: { type: Number, required: true },
    text: { type: String, required: true },
    /** Lightweight embedding placeholder — optional float array when provider available. */
    embedding: { type: [Number], default: undefined },
  },
  { _id: false }
)

const KnowledgeDocumentSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', default: null },
    knowledgeBaseId: { type: Schema.Types.ObjectId, ref: 'KnowledgeBase', required: true },
    title: { type: String, required: true },
    sourceType: { type: String, enum: ['text', 'upload', 'url'], default: 'text' },
    status: {
      type: String,
      enum: ['pending', 'indexed', 'failed', 'deleted'],
      default: 'pending',
    },
    contentText: { type: String, default: '' },
    chunks: { type: [KnowledgeChunkSchema], default: [] },
    error: { type: String, default: '' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
)

KnowledgeDocumentSchema.index({ organizationId: 1, knowledgeBaseId: 1, status: 1 })
KnowledgeDocumentSchema.index({ organizationId: 1, workspaceId: 1 })

export const KnowledgeDocument =
  (models.KnowledgeDocument || model('KnowledgeDocument', KnowledgeDocumentSchema)) as any
