/**
 * Gradual adoption of the governance permission layer.
 * When false (default), existing role-rank helpers remain the sole enforcement path.
 * Never disables tenant isolation or existing requireOrganizationAccess / requireWorkspaceAccess.
 */
export function isGovernanceEnforcementEnabled(): boolean {
  return process.env.GOVERNANCE_ENFORCEMENT_ENABLED === 'true'
}

export function isGovernanceCustomRolesEnabled(): boolean {
  return process.env.GOVERNANCE_CUSTOM_ROLES_ENABLED === 'true'
}

export function isGovernanceAuditLogsEnabled(): boolean {
  return process.env.GOVERNANCE_AUDIT_LOGS_ENABLED === 'true'
}

export function isGovernanceApiKeysEnabled(): boolean {
  return process.env.GOVERNANCE_API_KEYS_ENABLED === 'true'
}

export function isGovernanceSecurityPoliciesEnabled(): boolean {
  return process.env.GOVERNANCE_SECURITY_POLICIES_ENABLED === 'true'
}

export function isGovernanceDataExportEnabled(): boolean {
  return process.env.GOVERNANCE_DATA_EXPORT_ENABLED === 'true'
}
