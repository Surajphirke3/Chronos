import { z } from 'zod'
import { Types } from 'mongoose'
import { connectDB } from '@/lib/mongodb/client'
import { Organization } from '@/lib/mongodb/models/Organization'
import { requireOrganizationAccess } from '@/lib/tenancy/context'
import { parseWithSchema } from '@/lib/api/validation'
import { apiForbidden, apiNotFound, apiOk, apiUnauthorized } from '@/lib/api/response'
import { tenantErrorResponse } from '@/lib/tenancy/http'
import { isValidSlug, slugify } from '@/lib/tenancy/slug'

const updateSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  description: z.string().trim().max(500).optional(),
  logoUrl: z.string().trim().max(500).optional(),
  slug: z.string().trim().min(2).max(64).optional(),
})

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!Types.ObjectId.isValid(id)) return apiNotFound()
    const ctx = await requireOrganizationAccess(id, 'member')
    await connectDB()
    const org = await Organization.findById(id)
      .select('name slug description logoUrl status settings createdAt updatedAt')
      .lean()
    if (!org) return apiNotFound()
    return apiOk({ organization: org, role: ctx.orgRole })
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
    await requireOrganizationAccess(id, 'admin')

    const body = await req.json()
    const parsed = parseWithSchema(updateSchema, body)
    if (parsed.ok === false) return parsed.response

    await connectDB()
    const updates: Record<string, unknown> = {}
    if (parsed.data.name) updates.name = parsed.data.name
    if (parsed.data.description !== undefined) updates.description = parsed.data.description
    if (parsed.data.logoUrl !== undefined) updates.logoUrl = parsed.data.logoUrl
    if (parsed.data.slug) {
      const slug = slugify(parsed.data.slug)
      if (!isValidSlug(slug)) {
        return tenantErrorResponse(Object.assign(new Error('Invalid slug'), { status: 400 }))
      }
      const clash = await Organization.findOne({ slug, _id: { $ne: id } }).lean()
      if (clash) {
        return tenantErrorResponse(Object.assign(new Error('Slug already in use'), { status: 409 }))
      }
      updates.slug = slug
    }

    const org = await Organization.findOneAndUpdate(
      { _id: id, status: 'active' },
      { $set: updates },
      { new: true }
    )
      .select('name slug description logoUrl status settings createdAt updatedAt')
      .lean()

    if (!org) return apiNotFound()
    return apiOk({ organization: org })
  } catch (error) {
    const status = (error as { status?: number })?.status
    if (status === 401) return apiUnauthorized()
    if (status === 403) return apiForbidden()
    return tenantErrorResponse(error)
  }
}
