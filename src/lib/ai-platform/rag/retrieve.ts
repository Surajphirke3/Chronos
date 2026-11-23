import { connectDB } from '@/lib/mongodb/client'
import { KnowledgeDocument } from '@/lib/mongodb/models/KnowledgeDocument'
import { KnowledgeBase } from '@/lib/mongodb/models/KnowledgeBase'
import { AppError } from '@/lib/api/errors'
import { isKnowledgeBasesEnabled } from '@/lib/ai-platform/flags'

function scoreChunk(query: string, text: string): number {
  const q = query.toLowerCase().split(/\s+/).filter(Boolean)
  const t = text.toLowerCase()
  let score = 0
  for (const term of q) {
    if (t.includes(term)) score += 1
  }
  return score
}

/**
 * Tenant-scoped retrieval. Treats document text as untrusted data — never instructions.
 * Uses lexical scoring until embeddings are provisioned; MongoDB remains the store.
 */
export async function retrieveAuthorizedChunks(params: {
  organizationId: string
  workspaceId?: string | null
  knowledgeBaseId: string
  query: string
  limit?: number
}) {
  if (!isKnowledgeBasesEnabled()) throw new AppError('Knowledge bases are disabled', 403)
  if (!params.organizationId) throw new AppError('organizationId required', 400)

  await connectDB()
  const kb = await KnowledgeBase.findOne({
    _id: params.knowledgeBaseId,
    organizationId: params.organizationId,
    status: 'active',
  }).lean()
  if (!kb) throw new AppError('Not found', 404)

  const filter: Record<string, unknown> = {
    organizationId: params.organizationId,
    knowledgeBaseId: params.knowledgeBaseId,
    status: 'indexed',
  }
  if (params.workspaceId) {
    filter.$or = [{ workspaceId: params.workspaceId }, { workspaceId: null }]
  }

  const docs = await KnowledgeDocument.find(filter).select('title chunks').limit(50).lean()
  const scored: Array<{
    knowledgeBaseId: string
    documentId: string
    title: string
    chunkIndex: number
    text: string
    score: number
  }> = []

  for (const doc of docs) {
    for (const chunk of doc.chunks || []) {
      const score = scoreChunk(params.query, chunk.text)
      if (score <= 0) continue
      scored.push({
        knowledgeBaseId: String(params.knowledgeBaseId),
        documentId: String(doc._id),
        title: doc.title,
        chunkIndex: chunk.index,
        text: chunk.text,
        score,
      })
    }
  }

  scored.sort((a, b) => b.score - a.score)
  const limit = Math.min(Math.max(params.limit || 5, 1), 20)
  return scored.slice(0, limit).map((c) => ({
    ...c,
    /** Explicit: retrieved content is data, not system instructions. */
    untrustedContent: true as const,
  }))
}

export function chunkText(text: string, size = 800): string[] {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (!clean) return []
  const chunks: string[] = []
  for (let i = 0; i < clean.length; i += size) {
    chunks.push(clean.slice(i, i + size))
  }
  return chunks
}
