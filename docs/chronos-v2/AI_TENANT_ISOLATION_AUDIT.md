# AI Tenant Isolation Audit (Phase 2.5)

## Routes inspected

| Route | Loads tenant DB by ID? | Pre-fix auth | Post-fix |
|---|---|---|---|
| `/api/ai/chat` | No (client messages) | Session only | `requireAiTenantContext` + user AI budget |
| `/api/ai/summarize` | No (client text) | Session only | Same |
| `/api/ai/generate-tasks` | No (client text) | Session only | Same |
| `/api/ai/prd-writer` | No (client fields) | Session only | Same |
| `/api/outreach/generate` | No (client lead object) | Session only, no AI budget | Tenant gate + AI budget |
| Workflow engine AI | Yes — lead via `execution.leadId` | Execution owner settings | Lead loaded from execution created under scoped execute API |

## Findings

1. **No direct IDOR of docs/chats/projects through AI routes** — payloads are client-supplied; routes do not `findById` workspace resources.
2. **Pre-fix gap:** AI routes authenticated only; under `MULTI_TENANT_ENFORCE=true` a user without workspace could still call AI. **Fixed** via `requireAiTenantContext()`.
3. **Usage limits** remain **per-user** (`assertAiBudget(userId)`), not per-organization. Acceptable for Phase 2; document for future billing.
4. **Workflow-triggered AI** uses `execution.ownerId` UserSettings and `Lead.findById(execution.leadId)`. Executions are created only after workspace-scoped workflow/lead selection in `/api/workflows/:id/execute`. Residual risk: historical executions created before tenancy must be migrated (`workspaceId` backfill) before enforce.
5. **Client-supplied lead PII** in `/api/outreach/generate` can only leak what the client already knows; it is not a server-side cross-tenant read.

## Residual

- AI chat history is not persisted server-side in these routes (no cross-workspace history store).
- Future AI features that retrieve docs/messages by ID **must** use `findAccessibleProject` / `workspaceScopedFilter`.
