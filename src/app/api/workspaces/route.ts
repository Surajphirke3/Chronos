import { z } from 'zod'
import { connectDB } from '@/lib/mongodb/client'
import { Workspace } from '@/lib/mongodb/models/Workspace'
import { WorkspaceMembership } from '@/lib/mongodb/models/WorkspaceMembership'
import { Organization } from '@/lib/mongodb/models/Organization'
import { requireAuthenticatedUser, requireOrganizationAccess } from '@/lib/tenancy/context'
import { isValidSlug, slugify } from '@/lib/tenancy/slug'
import { parseWithSchema, objectIdSchema } from '@/lib/api/validation'
import { apiOk, apiUnauthorized } from '@/lib/api/response'
import { tenantErrorResponse } from '@/lib/tenancy/http'
import { AppError } from '@/lib/api/errors'

const createSchema = z.object({
  organizationId: objectIdSchema,
  name: z.string().trim().min(2).max(100),
  slug: z.string().trim().min(2).max(64).optional(),
  description: z.string().trim().max(500).optional(),
  type: z
    .enum(['general', 'engineering', 'operations', 'marketing', 'sales', 'client'])
    .optional(),
})

export async function GET() {
  try {
    const auth = await requireAuthenticatedUser()
    await connectDB()

    const memberships = await WorkspaceMembership.find({
      userId: auth.userId,
      status: 'active',
    }).lean()

    const workspaceIds = memberships.map((m: { workspaceId: unknown }) => m.workspaceId)
    const workspaces = await Workspace.find({
      _id: { $in: workspaceIds },
      status: 'active',
    })
      .select('name slug description type organizationId isDefault status')
      .sort({ name: 1 })
      .lean()

    const orgIds = [...new Set(workspaces.map((w: { organizationId: unknown }) => String(w.organizationId)))]
    const orgs = await Organization.find({ _id: { $in: orgIds } })
      .select('name slug')
      .lean()
    const orgMap = new Map(orgs.map((o: { _id: { toString: () => string } }) => [String(o._id), o]))

    const roleByWs = new Map(
      memberships.map((m: { workspaceId: { toString: () => string }; role: string }) => [
        String(m.workspaceId),
        m.role,
      ])
    )

    return apiOk({
      workspaces: workspaces.map((ws: { _id: { toString: () => string }; organizationId: unknown }) => ({
        ...ws,
        role: roleByWs.get(String(ws._id)) || 'member',
        organization: orgMap.get(String(ws.organizationId)) || null,
      })),
    })
  } catch (error) {
    if ((error as { status?: number })?.status === 401) return apiUnauthorized()
    return tenantErrorResponse(error, 'Failed to list workspaces')
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireAuthenticatedUser()
    const body = await req.json()
    const parsed = parseWithSchema(createSchema, body)
    if (parsed.ok === false) return parsed.response

    await requireOrganizationAccess(parsed.data.organizationId, 'admin')
    await connectDB()

    let slug = slugify(parsed.data.slug || parsed.data.name)
    if (!isValidSlug(slug)) throw new AppError('Invalid workspace slug', 400)

    const clash = await Workspace.findOne({
      organizationId: parsed.data.organizationId,
      slug,
    }).lean()
    if (clash) slug = `${slug}-${Date.now().toString(36).slice(-4)}`

    const workspace = await Workspace.create({
      organizationId: parsed.data.organizationId,
      name: parsed.data.name,
      slug,
      description: parsed.data.description || '',
      type: parsed.data.type || 'general',
      createdBy: auth.userId,
      isDefault: false,
      status: 'active',
    })

    await WorkspaceMembership.create({
      organizationId: parsed.data.organizationId,
      workspaceId: workspace._id,
      userId: auth.userId,
      role: 'owner',
      status: 'active',
      joinedAt: new Date(),
    })

    return apiOk({ workspace }, { status: 201 })
  } catch (error) {
    if ((error as { status?: number })?.status === 401) return apiUnauthorized()
    return tenantErrorResponse(error, 'Failed to create workspace')
  }
}
