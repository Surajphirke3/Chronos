/** When true, workspace-scoped APIs require verified workspace membership and IDs. */
export function isMultiTenantEnforced(): boolean {
  return process.env.MULTI_TENANT_ENFORCE === 'true'
}

export const DEFAULT_ORG_MIGRATION_KEY = 'chronos-default-organization-v1'
export const DEFAULT_WORKSPACE_MIGRATION_KEY = 'chronos-default-workspace-v1'
