import type { TenantContext } from '@/lib/tenancy/context'
import {
  permissionActorFromTenant,
  type PermissionActor,
} from '@/lib/governance/permissions/evaluate'
import { resolveCustomRolePermissions } from './service'

/** Build a PermissionActor including custom-role extras when the feature flag is on. */
export async function buildPermissionActor(
  ctx: Pick<
    TenantContext,
    | 'userId'
    | 'platformRole'
    | 'legacyRole'
    | 'organizationId'
    | 'workspaceId'
    | 'orgRole'
    | 'workspaceRole'
  >
): Promise<PermissionActor> {
  const base = permissionActorFromTenant(ctx)
  if (!ctx.organizationId) return base
  const extras = await resolveCustomRolePermissions(ctx.organizationId, ctx.userId)
  return { ...base, extraPermissions: extras }
}
