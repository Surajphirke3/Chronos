import { connectDB } from '@/lib/mongodb/client'
import { Organization } from '@/lib/mongodb/models/Organization'
import { Workspace } from '@/lib/mongodb/models/Workspace'
import { Membership } from '@/lib/mongodb/models/Membership'
import { WorkspaceMembership } from '@/lib/mongodb/models/WorkspaceMembership'
import { User } from '@/lib/mongodb/models/User'
import { isValidSlug, slugify } from '@/lib/tenancy/slug'
import { AppError } from '@/lib/api/errors'

export async function createOrganizationWithDefaultWorkspace(params: {
  name: string
  slug?: string
  description?: string
  userId: string
}): Promise<{ organizationId: string; workspaceId: string }> {
  await connectDB()

  const name = params.name.trim()
  if (!name) throw new AppError('Organization name is required', 400)

  let slug = slugify(params.slug || name)
  if (!isValidSlug(slug)) throw new AppError('Invalid organization slug', 400)

  const existingSlug = await Organization.findOne({ slug }).lean()
  if (existingSlug) {
    slug = `${slug}-${Date.now().toString(36).slice(-4)}`
  }

  const organization = await Organization.create({
    name,
    slug,
    description: params.description || '',
    createdBy: params.userId,
    status: 'active',
  })

  const workspace = await Workspace.create({
    organizationId: organization._id,
    name: 'General',
    slug: 'general',
    description: 'Default workspace',
    type: 'general',
    createdBy: params.userId,
    isDefault: true,
    status: 'active',
  })

  await Membership.create({
    organizationId: organization._id,
    userId: params.userId,
    role: 'owner',
    status: 'active',
    joinedAt: new Date(),
  })

  await WorkspaceMembership.create({
    organizationId: organization._id,
    workspaceId: workspace._id,
    userId: params.userId,
    role: 'owner',
    status: 'active',
    joinedAt: new Date(),
  })

  await User.findByIdAndUpdate(params.userId, {
    activeOrganizationId: organization._id,
    activeWorkspaceId: workspace._id,
  })

  return {
    organizationId: String(organization._id),
    workspaceId: String(workspace._id),
  }
}
