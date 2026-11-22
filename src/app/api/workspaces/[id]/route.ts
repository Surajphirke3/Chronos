import { Types } from 'mongoose'
import { z } from 'zod'
import { connectDB } from '@/lib/mongodb/client'
import { Workspace } from '@/lib/mongodb/models/Workspace'
import { requireWorkspaceAccess } from '@/lib/tenancy/context'
import { parseWithSchema } from '@/lib/api/validation'
import { apiForbidden, apiNotFound, apiOk, apiUnauthorized } from '@/lib/api/response'
import { tenantErrorResponse } from '@/lib/tenancy/http'
import { AppError } from '@/lib/api/errors'
import { isValidSlug, slugify } from '@/lib/tenancy/slug'

const updateSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  description: z.string().trim().max(500).optional(),
  slug: z.string().trim().min(2).max(64).optional(),
  type: z
    .enum(['general', 'engineering', 'operations', 'marketing', 'sales', 'client'])
    .optional(),
  status: z.enum(['active', 'archived']).optional(),
})

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!Types.ObjectId.isValid(id)) return apiNotFound()
    const ctx = await requireWorkspaceAccess(id, 'guest')
    await connectDB()
    const workspace = await Workspace.findById(id)
      .select('name slug description type organizationId isDefault status settings createdAt updatedAt')
      .lean()
    if (!workspace) return apiNotFound()
    return apiOk({ workspace, role: ctx.workspaceRole })
  } catch (error) {
    const status = (error as { status?: number })?.status
    if (status === 401) return apiUnauthorized()
    if (status === 403) return apiForbidden()
    return tenantErrorResponse(error)
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!Types.ObjectId.isValid(id)) return apiNotFound()
    await requireWorkspaceAccess(id, 'admin')

    const body = await req.json()
    const parsed = parseWithSchema(updateSchema, body)
    if (parsed.ok === false) return parsed.response

    await connectDB()
    const existing = await Workspace.findById(id)
    if (!existing) return apiNotFound()

    if (parsed.data.status === 'archived' && existing.isDefault) {
      throw new AppError('Cannot archive the default workspace', 400)
    }

    if (parsed.data.name) existing.name = parsed.data.name
    if (parsed.data.description !== undefined) existing.description = parsed.data.description
    if (parsed.data.type) existing.type = parsed.data.type
    if (parsed.data.status) existing.status = parsed.data.status
    if (parsed.data.slug) {
      const slug = slugify(parsed.data.slug)
      if (!isValidSlug(slug)) throw new AppError('Invalid slug', 400)
      const clash = await Workspace.findOne({
        organizationId: existing.organizationId,
        slug,
        _id: { $ne: id },
      }).lean()
      if (clash) throw new AppError('Slug already in use in this organization', 409)
      existing.slug = slug
    }

    await existing.save()
    return apiOk({ workspace: existing })
  } catch (error) {
    const status = (error as { status?: number })?.status
    if (status === 401) return apiUnauthorized()
    if (status === 403) return apiForbidden()
    return tenantErrorResponse(error)
  }
}
