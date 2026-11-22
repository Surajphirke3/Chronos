# Tenant API Audit Matrix (Phase 2.5)

**Branch:** `feat/chronos-v2-phase-2`  
**Method:** Source inspection of every `src/app/api/**/route.ts`  
**Flag state audited:** `MULTI_TENANT_ENFORCE=false` (dual-read) and `true` (enforce)

Legend: **OK** / **FIXED** / **ACCEPT** (by design) / **GAP** (residual, non-blocking for staging cutover prep)

| Route | Scope | Auth | Tenant check | Query scoping | Nested parent check | Verdict |
|---|---|---|---|---|---|---|
| `POST /api/auth/[...nextauth]` | Auth | NextAuth | N/A | N/A | N/A | ACCEPT |
| `POST /api/auth/register` | Auth | Public + rate limit | N/A | Creates global user | N/A | ACCEPT |
| `GET/PUT /api/user/settings` | User-global | Session | User owns settings | `userId=session` | N/A | OK |
| `GET /api/health` | Public | None | N/A | N/A | N/A | ACCEPT |
| `POST/GET /api/cron/workflows/resume` | Platform cron | `CHRONOS_CRON_SECRET` | Executions by lease/owner | Worker uses execution.ownerId | Lead via execution | ACCEPT (ops secret) |
| `GET/POST /api/organizations` | Org | Auth + membership | List via Membership | Membership.userId | N/A | OK |
| `GET/PATCH /api/organizations/:id` | Org | `requireOrganizationAccess` | Membership + role | By org id after authz | N/A | OK |
| `GET/DELETE /api/organizations/:id/members` | Org | member/admin | Membership | Org-scoped | Owner protected | OK |
| `POST /api/organizations/:id/transfer` | Org | owner | Owner only | Membership updates | Target must be member | OK |
| `GET/POST /api/workspaces` | Workspace | Auth / org admin | Membership lists | Active memberships only | Org admin for create | OK |
| `GET/PATCH /api/workspaces/:id` | Workspace | `requireWorkspaceAccess` | Org+WS membership | Active WS in org | Default archive blocked | OK |
| `GET/POST/DELETE /api/workspaces/:id/members` | Workspace | guest/admin | WS membership | Org membership required before add | Owner protected | OK |
| `GET/POST /api/context` | Context | Auth / WS guest | Switch revalidates membership | User active IDs updated | WS must belong to org | OK |
| `GET/POST /api/invitations` | Invite | Org/WS admin | Role assign checks | Org-scoped list | WS must match org | OK |
| `POST /api/invitations/preview` | Invite | Rate-limited public | Token hash lookup | No tokenHash returned | N/A | OK (enumeration residual) |
| `POST /api/invitations/accept` | Invite | Auth + rate limit | Email in atomic claim | Membership upsert | WS grant verified | **FIXED** |
| `POST /api/invitations/:id/revoke` | Invite | Org admin | Org access on invite.org | Status→revoked | N/A | OK |
| `GET/POST /api/projects` | Workspace | Tenant context | Project ACL + WS | `projectVisibilityFilter` | N/A | OK / **FIXED** dual-read |
| `GET/PATCH/DELETE /api/projects/:id` | Workspace | Tenant context | `canAccessProject` | 404 on deny | Tasks deleted with project | **FIXED** legacy admin mutate |
| `GET/POST /api/tasks` | Via Project | Tenant context | `findAccessibleProject` | Project visibility | Parent project required | OK |
| `GET/PATCH/DELETE /api/tasks/:id` | Via Project | Tenant context | Parent project ACL | Move checks target project | Parent project | OK |
| `GET/POST /api/docs` | Workspace | Tenant context | Author/project + WS filter | `workspaceScopedFilter` | Project attach checked | OK / **FIXED** dual-read |
| `GET/PATCH/DELETE /api/docs/:id` | Workspace | Tenant context | `assertResourceInWorkspace` | Dual-read gated | Project attach checked | OK |
| `GET/DELETE /api/leads` | Workspace | Tenant context | WS member / owner | Scoped (+ dual-read gate) | N/A | OK / **FIXED** dual-read |
| `POST /api/leads/import` | Workspace | Tenant context | Member+ | Writes org/WS ids | N/A | OK |
| `GET/POST /api/workflows` | Workspace | Tenant context | WS scope | Scoped (+ dual-read gate) | N/A | OK / **FIXED** dual-read |
| `GET/PATCH/DELETE /api/workflows/:id` | Workspace | Tenant context | Scoped find | Assert WS | N/A | OK |
| `POST /api/workflows/:id/execute` | Workspace | Tenant context | Workflow + leads scoped | Executions tagged | Lead IDs cannot cross WS | OK |
| `GET /api/outreach/stats` | Workspace | Tenant context | Scoped aggregates | Scoped | N/A | OK / **FIXED** dual-read |
| `POST /api/outreach/generate` | AI helper | Tenant gate + AI budget | No DB lead load | Client payload | N/A | **FIXED** gate |
| `GET/POST /api/chats` | Workspace | Tenant context | Participants + WS | Aggregate match | Participants must be WS members | OK |
| `GET /api/chats/:chatId` | Workspace | Tenant context | Participant + WS | Messages via chatId after chat authz | Chat parent | OK |
| `POST /api/chats/:chatId/messages` | Workspace | Tenant context | Participant + WS | Chat parent first | Chat parent | OK |
| `GET /api/activity` | Workspace | Tenant context | Actor/project + WS | Scoped | Project visibility | OK |
| `GET/PATCH /api/team` | Workspace/Org | Tenant context | WS/org membership directory | No global User.find | PATCH cannot set User.role | OK |
| `POST /api/ai/*` | AI | Tenant gate + budget | No tenant DB reads by ID | Client payload | N/A | **FIXED** gate |

## Critical finding (fixed)

Before Phase 2.5, `workspaceScopedFilter` under dual-read included `{ workspaceId: null }` for **every** active workspace. A member of a newly created organization could list unscoped legacy workflows/leads/docs/chats/stats belonging to the pre-migration deployment.

**Fix:** dual-read unscoped rows only when `allowsLegacyUnscopedRead` is true (default migrated org + default migrated workspace).
