import { getActiveTenantContext, type TenantContext } from '@/lib/tenancy/context'
import { isMultiTenantEnforced } from '@/lib/tenancy/flags'

/**
 * AI endpoints do not load tenant DB records by ID today (client-supplied payloads).
 * When enforcement is on, still require a verified active workspace so AI usage
 * cannot proceed without tenant membership.
 */
export async function requireAiTenantContext(): Promise<TenantContext> {
  return getActiveTenantContext({ requireWorkspace: isMultiTenantEnforced() })
}
