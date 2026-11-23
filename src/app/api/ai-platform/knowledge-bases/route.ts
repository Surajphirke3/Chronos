import { z } from 'zod'
import { getActiveTenantContext } from '@/lib/tenancy/context'
import { tenantErrorResponse, jsonOk } from '@/lib/tenancy/http'
import { parseWithSchema } from '@/lib/api/validation'
import { apiError } from '@/lib/api/response'
import { connectDB } from '@/lib/mongodb/client'
import { KnowledgeBase } from '@/lib/mongodb/models/KnowledgeBase'
import { KnowledgeDocument } from '@/lib/mongodb/models/KnowledgeDocument'
import { isKnowledgeBasesEnabled } from '@/lib/ai-platform/flags'
import { chunkText } from '@/lib/ai-platform/rag/retrieve'

const createKbSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().max(1000).optional(),
  })
  .strict()

const ingestSchema = z
  .object({
    knowledgeBaseId: z.string().regex(/^[a-fA-F0-9]{24}$/),
    title: z.string().trim().min(1).max(200),
    contentText: z.string().min(1).max(200_000),
  })
  .strict()

export async function GET() {
  try {
    const ctx = await getActiveTenantContext({ requireWorkspace: false })
    if (!ctx.organizationId) return apiError('Active organization required', 400)
    if (!isKnowledgeBasesEnabled()) return apiError('Knowledge bases are disabled', 403)
    await connectDB()
    const knowledgeBases = await KnowledgeBase.find({
      organizationId: ctx.organizationId,
      status: 'active',
    })
      .sort({ name: 1 })
      .lean()
    return jsonOk({ knowledgeBases })
  } catch (e) {
    return tenantErrorResponse(e)
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await getActiveTenantContext({ requireWorkspace: false })
    if (!ctx.organizationId) return apiError('Active organization required', 400)
    if (!isKnowledgeBasesEnabled()) return apiError('Knowledge bases are disabled', 403)
    const body = await req.json()
    if (body?.contentText) {
      const parsed = parseWithSchema(ingestSchema, body)
      if (parsed.ok === false) return parsed.response
      await connectDB()
      const kb = await KnowledgeBase.findOne({
        _id: parsed.data.knowledgeBaseId,
        organizationId: ctx.organizationId,
        status: 'active',
      })
      if (!kb) return apiError('Not found', 404)
      const chunks = chunkText(parsed.data.contentText).map((text, index) => ({ index, text }))
      const doc = await KnowledgeDocument.create({
        organizationId: ctx.organizationId,
        workspaceId: ctx.workspaceId,
        knowledgeBaseId: kb._id,
        title: parsed.data.title,
        sourceType: 'text',
        status: 'indexed',
        contentText: parsed.data.contentText,
        chunks,
        createdBy: ctx.userId,
      })
      return jsonOk({ document: { _id: doc._id, title: doc.title, status: doc.status, chunkCount: chunks.length } }, 201)
    }

    const parsed = parseWithSchema(createKbSchema, body)
    if (parsed.ok === false) return parsed.response
    await connectDB()
    const kb = await KnowledgeBase.create({
      organizationId: ctx.organizationId,
      workspaceId: ctx.workspaceId,
      name: parsed.data.name,
      description: parsed.data.description || '',
      createdBy: ctx.userId,
    })
    return jsonOk({ knowledgeBase: kb }, 201)
  } catch (e) {
    return tenantErrorResponse(e)
  }
}
