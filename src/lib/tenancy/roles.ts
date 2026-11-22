export type OrgRole = 'owner' | 'admin' | 'member'
export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'guest'

const ORG_RANK: Record<OrgRole, number> = { owner: 3, admin: 2, member: 1 }
const WS_RANK: Record<WorkspaceRole, number> = { owner: 4, admin: 3, member: 2, guest: 1 }

export function orgRoleAtLeast(role: string | undefined, minimum: OrgRole): boolean {
  if (!role || !(role in ORG_RANK)) return false
  return ORG_RANK[role as OrgRole] >= ORG_RANK[minimum]
}

export function workspaceRoleAtLeast(role: string | undefined, minimum: WorkspaceRole): boolean {
  if (!role || !(role in WS_RANK)) return false
  return WS_RANK[role as WorkspaceRole] >= WS_RANK[minimum]
}

export function canAssignOrgRole(actorRole: string | undefined, targetRole: string): boolean {
  if (!orgRoleAtLeast(actorRole, 'admin')) return false
  if (targetRole === 'owner') return actorRole === 'owner'
  if (targetRole === 'admin') return orgRoleAtLeast(actorRole, 'admin')
  return ['member'].includes(targetRole)
}

export function canAssignWorkspaceRole(actorRole: string | undefined, targetRole: string): boolean {
  if (!workspaceRoleAtLeast(actorRole, 'admin')) return false
  if (targetRole === 'owner') return actorRole === 'owner'
  if (targetRole === 'admin') return workspaceRoleAtLeast(actorRole, 'admin')
  return ['member', 'guest'].includes(targetRole)
}
