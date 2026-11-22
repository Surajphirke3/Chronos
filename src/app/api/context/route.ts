import { z } from 'zod'
import { connectDB } from '@/lib/mongodb/client'
import { User } from '@/lib/mongodb/models/User'
import { Workspace } from '@/lib/mongodb/models/Workspace'
import {
  getActiveTenantContext,
  requireAuthenticatedUser,
  requireWorkspaceAccess,
} from '@/lib/tenancy/context'
import { parseWithSchema, objectIdSchema } from '@/lib/api/validation'
import { apiOk, apiUnauthorized } from '@/lib/api/response'
import { tenantErrorResponse } from '@/lib/tenancy/http'
import { AppError } from '@/lib/api/errors'

const switchSchema = z.object({
  workspaceId: objectIdSchema,
  organizationId: objectIdSchema.optional(),
})

export async function GET() {
  try {
    const ctx = await getActiveTenantContext({ requireWorkspace: false })
    return apiOk({
      userId: ctx.userId,
      organizationId: ctx.organizationId,
      workspaceId: ctx.workspaceId,
      orgRole: ctx.orgRole,
      workspaceRole: ctx.workspaceRole,
      organization: ctx.organization,
      workspace: ctx.workspace,
      platformRole: ctx.platformRole,
    })
  } catch (error) {
    if ((error as { status?: number })?.status === 401) return apiUnauthorized()
    return tenantErrorResponse(error)
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireAuthenticatedUser()
    const body = await req.json()
    const parsed = parseWithSchema(switchSchema, body)
    if (parsed.ok === false) return parsed.response

    await connectDB()
    const workspace = await Workspace.findOne({
      _id: parsed.data.workspaceId,
      status: 'active',
    })
      .select('organizationId')
      .lean()
    if (!workspace) throw new AppError('Workspace not found', 404)

    const organizationId = String(workspace.organizationId)
    if (parsed.data.organizationId && parsed.data.organizationId !== organizationId) {
      throw new AppError('Workspace does not belong to the given organization', 400)
    }

    const ctx = await requireWorkspaceAccess(parsed.data.workspaceId, 'guest')

    await User.findByIdAndUpdate(auth.userId, {
      activeOrganizationId: ctx.organizationId,
      activeWorkspaceId: ctx.workspaceId,
    })

    return apiOk({
      organizationId: ctx.organizationId,
      workspaceId: ctx.workspaceId,
      orgRole: ctx.orgRole,
      workspaceRole: ctx.workspaceRole,
      organization: ctx.organization,
      workspace: ctx.workspace,
    })
  } catch (error) {
    if ((error as { status?: number })?.status === 401) return apiUnauthorized()
    return tenantErrorResponse(error)
  }
}
