import { connectDB } from '@/lib/mongodb/client'
import { Lead } from '@/lib/mongodb/models/Lead'
import { NextResponse } from 'next/server'
import { getActiveTenantContext, workspaceScopedFilter } from '@/lib/tenancy/context'
import { isMultiTenantEnforced } from '@/lib/tenancy/flags'
import { mergeMongoFilters, tenantErrorResponse } from '@/lib/tenancy/http'
import { objectIdSchema, paginationSchema, parseWithSchema } from '@/lib/api/validation'
import { z } from 'zod'
import { workspaceRoleAtLeast } from '@/lib/tenancy/roles'

export async function GET(req: Request) {
  try {
    const ctx = await getActiveTenantContext({ requireWorkspace: isMultiTenantEnforced() })
    const { searchParams } = new URL(req.url)
    const parsed = parseWithSchema(paginationSchema, {
      limit: searchParams.get('limit') || 50,
      page: searchParams.get('page') || 1,
    })
    if (parsed.ok === false) return parsed.response

    await connectDB()

    // Workspace members see workspace leads; dual-read falls back to owner-scoped legacy
    const scope = workspaceScopedFilter(ctx)
    const visibility =
      ctx.workspaceId && ctx.workspaceRole && workspaceRoleAtLeast(ctx.workspaceRole, 'member')
        ? {}
        : { ownerId: ctx.userId }

    const filter = mergeMongoFilters(scope, visibility)
    const page = parsed.data.page || 1
    const skip = (page - 1) * parsed.data.limit

    const [leads, total] = await Promise.all([
      Lead.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(parsed.data.limit)
        .lean(),
      Lead.countDocuments(filter),
    ])

    return NextResponse.json({
      leads,
      pagination: {
        page,
        limit: parsed.data.limit,
        total,
        totalPages: Math.ceil(total / parsed.data.limit) || 1,
        hasMore: skip + leads.length < total,
      },
    })
  } catch (error) {
    return tenantErrorResponse(error, 'Failed to fetch leads')
  }
}

const createLeadSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().max(100).optional().default(''),
  email: z.string().trim().email().max(320),
  company: z.string().trim().max(200).optional().default(''),
  title: z.string().trim().max(200).optional().default(''),
  linkedinUrl: z.string().trim().max(500).optional().default(''),
  phone: z.string().trim().max(50).optional().default(''),
})

export async function POST(req: Request) {
  try {
    const ctx = await getActiveTenantContext({ requireWorkspace: isMultiTenantEnforced() })
    if (ctx.workspaceRole && !workspaceRoleAtLeast(ctx.workspaceRole, 'member')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = parseWithSchema(createLeadSchema, body)
    if (parsed.ok === false) return parsed.response

    await connectDB()

    const email = parsed.data.email.toLowerCase()
    const existing = await Lead.findOne(
      mergeMongoFilters(workspaceScopedFilter(ctx), {
        email,
        ...(ctx.workspaceId ? {} : { ownerId: ctx.userId }),
      })
    ).lean()
    if (existing) {
      return NextResponse.json({ error: 'A lead with this email already exists' }, { status: 409 })
    }

    const lead = await Lead.create({
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName || '',
      email,
      company: parsed.data.company || '',
      title: parsed.data.title || '',
      linkedinUrl: parsed.data.linkedinUrl || '',
      phone: parsed.data.phone || '',
      status: 'new',
      ownerId: ctx.userId,
      organizationId: ctx.organizationId || undefined,
      workspaceId: ctx.workspaceId || undefined,
    })

    return NextResponse.json({ lead, message: 'Lead added' }, { status: 201 })
  } catch (error) {
    return tenantErrorResponse(error, 'Failed to create lead')
  }
}

export async function DELETE(req: Request) {
  try {
    const ctx = await getActiveTenantContext({ requireWorkspace: isMultiTenantEnforced() })
    const { searchParams } = new URL(req.url)
    const idParsed = parseWithSchema(z.object({ id: objectIdSchema }), {
      id: searchParams.get('id'),
    })
    if (idParsed.ok === false) return idParsed.response

    await connectDB()
    const filter = mergeMongoFilters(workspaceScopedFilter(ctx), {
      _id: idParsed.data.id,
      ...(ctx.workspaceRole && workspaceRoleAtLeast(ctx.workspaceRole, 'admin')
        ? {}
        : { ownerId: ctx.userId }),
    })
    await Lead.deleteOne(filter)

    return NextResponse.json({ success: true })
  } catch (error) {
    return tenantErrorResponse(error, 'Failed to delete lead')
  }
}
