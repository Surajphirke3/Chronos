# Chronos V2 — Phase 5 Architecture: Enterprise Governance & Security

**Branch:** `feat/chronos-v2-phase-5`  
**Date:** 2026-11-23  
**Status:** Architecture **approved**. Checkpoint 1 (permission catalog) implemented. CP2+ pending review.  
**Based on:** live tree including Phase 3 + Phase 4 Checkpoint 1 billing models only

### Approved review answers (locked)

1. Custom roles are **additive** to system role maps in v1.  
2. `billing.manage` remains **organization-owner-only**; custom roles cannot grant it.  
3. Security-critical ops fail closed if durable audit write fails (CP3+).  
4. MFA remains **unsupported** — no fake toggle.  
5. Existing system role semantics must remain compatible.

### Checkpoint progress

| CP | Status |
|---|---|
| 0 Architecture | Done |
| 1 Permission catalog + evaluation | Done — see `PHASE_5_RBAC.md` |
| 2+ Custom roles, audit, keys, … | Not started |

---

## 0. Honest dependency status

| Phase | Code status relevant to Phase 5 |
|---|---|
| Phase 2 / 2.5 | Tenancy helpers, invitations, dual-read, `MULTI_TENANT_ENFORCE` — **implemented**; staging apply still ops |
| Phase 3 | Durable `Job` engine, schedules, automation dashboard — **implemented** with limitations |
| Phase 4 | **Partial:** Plan/Subscription/Payment/Invoice models + state machine + seeds only. **No** billing APIs, MockRazorpay, usage aggregates, entitlement enforcement, or billing UI yet |

Phase 5 must **not** rewrite Phase 4. Integration points assume billing APIs will land on the Phase 4 track; governance audit hooks attach when those mutations exist. Custom roles may eventually grant `billing.read` / `billing.manage`, but **owner-only billing mutations remain the Phase 4 default** until an explicit approved delegation model ships.

---

## 1. Current architecture (discovered)

### Authorization today

Four layers, **role-rank based** (no permission strings):

1. **Platform** — `User.platformRole === 'platform_admin'` via `isPlatformAdmin()` — **defined but unused by any route**.
2. **Organization** — `Membership.role`: owner | admin | member — `requireOrganizationAccess`, `orgRoleAtLeast`.
3. **Workspace** — `WorkspaceMembership.role`: owner | admin | member | guest — `requireWorkspaceAccess`.
4. **Resource** — Project `ownerId` + `members[]` — `canAccessProject` / `projectVisibilityFilter`.

**Legacy** `User.role` (`admin`|`member`) still exists; bypass paths shrink when `MULTI_TENANT_ENFORCE=true`. Must **never** be reinterpreted as platform admin.

There is **no** `hasPermission` / `assertPermission` / permission catalog / custom role model.

### Activity vs audit

`ActivityLog` records project/task/doc actions only. It is:

- Mutable (ordinary writes; no immutability controls)
- Incomplete for governance (no invite/member/transfer/billing events)
- Not suitable as a compliance audit ledger

### Settings UI

`/settings`, `/settings/organization`, `/settings/workspace` only. No audit, API keys, security policies, roles, or data-governance pages.

### Security controls present

- NextAuth JWT + credentials/Google; Google requires verified email
- bcrypt passwords; invitation token SHA-256 hashes; AES-GCM secrets
- Mongo rate limits
- Cron bearer secret for workers

### Security controls absent / unsupported

- **MFA** — no TOTP/WebAuthn; do **not** ship a fake MFA toggle
- Credentials email verification — not required
- Organization API keys
- Immutable `AuditEvent`
- Domain-restricted invites (policy layer)
- Data export / retention jobs
- Platform admin console routes

### Phase 3 reuse

`enqueueJob` + handler registry already require `organizationId`, `workspaceId`, `initiatedBy`, idempotency — correct substrate for `governance.export.*` and `governance.retention.*` handlers.

---

## 2. Proposed architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  Settings: roles | members | audit-logs | api-keys | security    │
│            | data-governance   (+ platform admin console later)  │
└────────────────────────────┬─────────────────────────────────────┘
                             │ session or API key auth
┌────────────────────────────▼─────────────────────────────────────┐
│  AuthN: NextAuth session  XOR  ApiKey bearer (hashed lookup)     │
└────────────────────────────┬─────────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────────┐
│  AuthZ service (deny-by-default for NEW capabilities)            │
│  resolveActor → memberships → system role map → custom roles     │
│  hasPermission / assertPermission / getEffectivePermissions      │
│  + existing requireOrganizationAccess / canAccessProject         │
└───────┬─────────────────────────────┬────────────────────────────┘
        │                             │
┌───────▼──────────┐         ┌────────▼────────────────────────────┐
│ AuditEvent write │         │ SecurityPolicy evaluation           │
│ (immutable append│         │ invite domains, guest access,       │
│  + redaction)    │         │ api key lifetime, export gates      │
└──────────────────┘         └─────────────────────────────────────┘
        │
┌───────▼──────────────────────────────────────────────────────────┐
│  Jobs: governance.export.request / governance.retention.preview  │
│        governance.retention.apply (flagged, dry-run default)     │
└──────────────────────────────────────────────────────────────────┘
```

**Principles**

1. Preserve existing org/workspace role ranks as **system roles** with a static permission map.
2. Custom roles are **additive org-scoped** permission sets assigned alongside (or instead of refining) `member`-class access — never cross-org.
3. New capabilities default deny unless system map or custom role grants them.
4. Existing routes keep working under role-rank helpers until `GOVERNANCE_ENFORCEMENT_ENABLED` gradually migrates call sites to `assertPermission`.
5. Feature flags never disable tenant isolation.
6. MFA remains **unsupported** until auth architecture supports it; policy field reserved or omitted from UI.

---

## 3. Data ownership

| Entity | Owner | Scope |
|---|---|---|
| `OrganizationRole` (custom) | Organization | Org only |
| `RoleAssignment` | Organization | User ↔ custom role within org |
| `AuditEvent` | Organization | Immutable append; optional workspaceId |
| `ApiKey` | Organization | Optional workspace restriction |
| `OrganizationSecurityPolicy` | Organization | One active doc per org |
| `DataExportRequest` | Organization | Job-backed artifacts |
| `RetentionPolicy` | Organization | Non-destructive defaults |

Platform audit of platform actions is a **separate** collection or `actorType: platform` with platform-only read APIs — never mixed into org export without explicit break-glass.

---

## 4. Permission evaluation model

### Catalog (typed constants)

Central module e.g. `src/lib/governance/permissions/catalog.ts`.

Namespaces aligned to real resources: `organization.*`, `members.*`, `workspaces.*`, `projects.*`, `workflows.*`, `automations.*`, `billing.*`, `api_keys.*`, `audit.*`, `security.*`, `data.*`.

Wildcards: **not** supported in v1 (explicit grants only).

### System role → permission matrix (compatibility)

| Permission (examples) | Org owner | Org admin | Org member | WS owner/admin | WS member | WS guest |
|---|---|---|---|---|---|---|
| organization.update | ✓ | ✓ | | | | |
| members.invite | ✓ | ✓ | | | | |
| members.roles.manage | ✓ | ✓* | | | | |
| billing.manage | ✓ | | | | | |
| billing.read | ✓ | ✓ | | | | |
| workspaces.create | ✓ | ✓ | | | | |
| projects.create | via WS | via WS | if WS member+ | ✓ | ✓ | |
| projects.read | via WS | via WS | via WS + ACL | ✓ | ✓ | limited |
| workflows.execute | via WS | via WS | via WS | ✓ | ✓ | |
| audit.read | ✓ | ✓ | | | | |
| api_keys.create | ✓ | ✓† | | | | |
| security.manage | ✓ | | | | | |
| data.export | ✓ | ✓† | | | | |

\* Admin cannot assign/remove owner.  
† Subject to security policy + feature flags.

Exact matrix delivered in `PHASE_5_RBAC.md` during Checkpoint 1; must preserve today’s effective access for existing roles.

### Evaluation order

1. Authenticate (session user or API key actor).
2. Resolve organization/workspace from **server** context / key binding — ignore client role claims.
3. If platform admin **and** platform route: platform path (separate).
4. Verify active membership (DB revalidation).
5. Union permissions from: system org role map + system workspace role map (scoped) + custom role assignments for that org.
6. Apply resource ACL (`canAccessProject`) where resource-level.
7. Apply security policy gates (e.g. guests disabled).
8. Apply billing entitlements when Phase 4 enforcement flag is on (orthogonal; keys cannot bypass).
9. Deny by default if permission not granted.

Suggested API:

```ts
hasPermission(ctx, permission, resource?)
assertPermission(ctx, permission, resource?) // throws AppError 403/404
getEffectivePermissions(ctx)
```

Existing `requireOrganizationAccess(minRole)` remains for gradual migration; new surfaces use permissions first.

---

## 5. Organization / workspace permission boundaries

- Custom roles: **organization-scoped** only; may include workspace-scoped permissions that still require a valid `WorkspaceMembership` to exercise in a workspace.
- Assigning a custom role never grants access to workspaces the user is not a member of.
- Guests remain least privilege; custom roles that would exceed guest cannot be assigned to guests without membership upgrade.
- Platform admin ≠ org owner; no universal tenant data bypass.

---

## 6. Audit event lifecycle

### Model: `AuditEvent` (new; do not overload `ActivityLog`)

Keep `ActivityLog` for product activity feed. Governance uses immutable `AuditEvent`.

Fields (proposed):

- `organizationId` (required), `workspaceId?`
- `actorUserId?`, `actorType`: `user` | `api_key` | `system` | `worker`
- `actorApiKeyId?` (prefix only in metadata)
- `action` (stable string), `resourceType`, `resourceId?`
- `outcome`: `success` | `failure` | `denied`
- `correlationId`, `requestId?`
- `ipHash?`, `userAgent?` (hashed/truncated; policy-gated)
- `before` / `after` redacted summaries
- `metadata` (allowlisted keys only)
- `source`: `web` | `api` | `worker` | `system`
- `schemaVersion`, `createdAt` (no updates)

Indexes: `{ organizationId, createdAt }`, `{ organizationId, action, createdAt }`, `{ organizationId, actorUserId, createdAt }`, `{ organizationId, resourceType, resourceId }`.

### Write semantics

| Class | Approach |
|---|---|
| Security-critical (role assign, key create/revoke, policy change, ownership transfer) | Attempt audit write in same request path; **fail the mutation** if audit persistence fails (document clearly) |
| High-volume product events | Best-effort audit or async job; product success not blocked |
| Worker actions | Audit with `actorType: worker` + initiating user from job payload |

Redaction service strips secrets, tokens, passwords, payment credentials, raw card data, full API keys.

Org users: **read-only** with `audit.read`. No update/delete APIs for org actors.

UI: `/settings/audit-logs` behind flag + permission.

---

## 7. API credential lifecycle

### Model: `ApiKey`

- `organizationId`, optional `workspaceId`
- `name`, `keyPrefix`, `secretHash` (scrypt/bcrypt or HMAC-SHA256 with server pepper)
- `scopes[]` (subset of permission catalog)
- `createdBy`, `expiresAt`, `revokedAt`, `status`
- `lastUsedAt` (throttled updates)
- `rateLimit` metadata

### Rules

1. Cryptographically secure secret; show **once** at creation.
2. Never store plaintext; never log full secret; never return again.
3. Auth via `Authorization: Bearer chronos_…` distinct from NextAuth session.
4. Keys **cannot** receive `platform_admin` or escalate beyond their scopes ∩ org policies.
5. Keys subject to tenant isolation + resource ACL + billing entitlements.
6. Create/revoke audited; creation requires `api_keys.create`.
7. Minimal authenticated probe endpoint only if needed (e.g. `GET /api/v1/me`) — **do not** auto-expose all internal handlers.
8. Feature flag `GOVERNANCE_API_KEYS_ENABLED`; disabled ⇒ reject key auth.

Rotation: create new key → overlap → revoke old (documented); optional soft dual-accept window later.

---

## 8. Security policy evaluation

### Model: `OrganizationSecurityPolicy`

Versioned settings, e.g.:

- `allowedInviteEmailDomains[]` (empty = unrestricted)
- `allowGuestAccess` (default true for compatibility)
- `whoCanInvite`: `owner` | `admin` | `members_with_permission`
- `allowApiKeyCreation` (default false until flag on)
- `maxApiKeyLifetimeDays`
- `allowDataExport`
- `restrictWorkspaceCreationToAdmins` (align with today’s admin-only create)
- `mfa`: `{ status: 'unsupported' }` — **not enforceable**; UI must not claim active MFA

Enforcement hooks on invite create, guest assign, API key create, export request.

Audited on change; `security.manage` = owner by default.

UI: `/settings/security`.

---

## 9. Data governance model

### Export

1. Authorized user with `data.export` creates `DataExportRequest`.
2. Enqueue Job `governance.export.run` with org/workspace scope, actor, correlationId, idempotencyKey.
3. Worker assembles org-scoped JSON/CSV artifact to secure storage path (or ephemeral signed download token).
4. Download requires re-auth + ownership check; expires.
5. Audit request + completion; never cross-tenant.

### Retention

1. Org retention settings (preview only by default).
2. Dry-run job lists candidates; apply requires explicit confirmation + flag.
3. **Never** bulk-delete `AuditEvent` as part of project cleanup.
4. No unrestricted “delete everything” API.

Do **not** claim GDPR/SOC2/ISO certification from these features alone.

---

## 10. Migration strategy

Script: `scripts/migrate-governance.ts` (dry-run default, `--apply` explicit).

1. Seed system permission catalog version constant (code, not necessarily DB).
2. Ensure each org has default `OrganizationSecurityPolicy` (compatible defaults).
3. **Do not** invent custom roles for all orgs.
4. Map existing Membership roles → equivalent effective permissions via code matrix (no Membership rewrite).
5. Backfill optional: write one `AuditEvent` `governance.bootstrap` per org (optional).
6. Never convert `User.role` → `platformRole`.
7. Counts before/after; idempotent; no production apply from CI/agent.

Compatibility matrix published in `PHASE_5_RBAC.md` / `PHASE_5_MIGRATION.md`.

---

## 11. Feature flags

| Flag | Default | Purpose |
|---|---|---|
| `GOVERNANCE_CUSTOM_ROLES_ENABLED` | false | Custom role CRUD/assign |
| `GOVERNANCE_AUDIT_LOGS_ENABLED` | false | Audit write path + UI (critical paths may still write when enforcement on) |
| `GOVERNANCE_API_KEYS_ENABLED` | false | Key auth + management |
| `GOVERNANCE_SECURITY_POLICIES_ENABLED` | false | Policy UI + non-default restrictions |
| `GOVERNANCE_DATA_EXPORT_ENABLED` | false | Export jobs |
| `GOVERNANCE_ENFORCEMENT_ENABLED` | false | New permission checks on migrated routes |

Tenant isolation and existing role gates remain always on.

---

## 12. Backward compatibility

- Existing owner/admin/member/guest behavior preserved via system permission map.
- Routes not yet migrated continue using `requireOrganizationAccess` / `requireWorkspaceAccess`.
- `ActivityLog` feed unchanged.
- Phase 3 jobs unchanged.
- Phase 4 models untouched; billing owner/admin policy unchanged.
- Flags default off ⇒ no sudden lockouts.

---

## 13. Threat model (abridged)

| Threat | Mitigation |
|---|---|
| Privilege escalation via custom role | Only admins/owners manage roles; cannot grant permissions actor lacks; validate catalog |
| Cross-org role assignment | orgId on role + assignment uniqueness; server ignores foreign IDs |
| Last owner demotion | Block remove/transfer of last owner (extend existing transfer safeguards) |
| API key leak | Hash at rest; prefix display; revoke; short expiry defaults; scopes |
| Audit tampering | No org update/delete; append-only; platform access audited separately |
| Secret in audit payload | Redaction allowlist |
| Fake MFA sense of security | Unsupported status only |
| Platform admin abuse | Separate routes; mandatory audit; no casual tenant dump |
| Export exfiltration | Permission + policy + job scope + expiring download |
| Client-supplied permissions | Ignored; server resolves |
| Stale JWT membership | Existing DB revalidation in tenant context |

---

## 14. Rollout plan

1. Ship Checkpoint 1–2 behind flags; staging only.
2. Enable audit writes for security-critical events in staging.
3. Enable custom roles for pilot orgs.
4. API keys only after key auth hardened + rate limits.
5. Data export last among client features.
6. `GOVERNANCE_ENFORCEMENT_ENABLED` after compatibility tests + staging IDOR suite.
7. Production flags remain off until explicit approval.
8. Rollback = disable flags (isolation remains).

---

## 15. Failure scenarios

| Failure | Behavior |
|---|---|
| Audit write fails on key revoke | Fail revoke (security-critical) |
| Audit write fails on project create | Allow create; log warning (non-critical class) |
| Export job crash | Retry/DLQ via Phase 3; request status `failed` |
| Policy invalid | Reject update with 400 |
| Flag off but client hits new API | 404/403 feature disabled |
| Concurrent last-owner removal | Atomic ownership checks |

---

## 16. Test strategy

- Unit: catalog completeness, system role matrix, redaction, key hashing, transition/assignment rules
- Integration: custom role isolation, audit scoping, key auth, export job idempotency
- Security: privilege escalation, cross-tenant, platform separation, revoked membership, stale context
- Regression: Phase 2 tenancy tests, Phase 3 job/state tests, Phase 4 billing model/state tests
- Commands: `npm run test`, `typecheck`, `lint`, `build` — report only after execution

---

## 17. Files expected to change (when implementation starts)

```
docs/chronos-v2/PHASE_5_*.md
src/lib/governance/**           # catalog, authz, audit, policies, keys, export
src/lib/mongodb/models/OrganizationRole.ts
src/lib/mongodb/models/RoleAssignment.ts
src/lib/mongodb/models/AuditEvent.ts
src/lib/mongodb/models/ApiKey.ts
src/lib/mongodb/models/OrganizationSecurityPolicy.ts
src/lib/mongodb/models/DataExportRequest.ts
src/app/api/governance/** or /api/roles, /api/audit, /api/api-keys, /api/security, /api/data-export
src/app/(workspace)/settings/{roles,audit-logs,api-keys,security,data-governance}/**
src/lib/automation/handlers/governance*.ts
src/lib/tenancy/context.ts      # thin integration; avoid rewrite
scripts/migrate-governance.ts
```

Touch billing routes only to add audit hooks when those routes exist — do not invent them here.

---

## 18. Checkpoint and commit sequence

| CP | Scope | Example commit |
|---|---|---|
| 0 | Architecture + master plan | `docs(phase-5): add enterprise governance architecture` ← **this** |
| 1 | Permission catalog + evaluation + regression | `feat(auth): introduce centralized permission catalog` |
| 2 | Custom roles + APIs + UI | `feat(rbac): add organization custom roles` |
| 3 | AuditEvent + hooks + dashboard | `feat(audit): implement immutable organization audit events` |
| 4 | API keys | `feat(api-keys): add scoped organization credentials` |
| 5 | Security policies | `feat(security): add organization security policies` |
| 6 | Data export/retention | `feat(governance): implement data export and retention` |
| 7 | Platform governance | `feat(admin): add platform governance controls` |
| 8 | Hardening + docs + tests | `test(phase-5): add governance security regression coverage` |

**Stop after each checkpoint for review.** Do not start CP1 until this document is approved.

---

## 19. Known limitations (declared upfront)

- Phase 4 billing runtime incomplete; governance integrates when available.
- MFA unsupported — no fake control.
- No compliance certification claims.
- `ActivityLog` remains a separate product feed.
- API keys will not automatically unlock all App Router handlers.
- At-least-once export/retention via jobs; not exactly-once external side effects.
- IP/UA storage minimized / hashed; legal review for retention is out of band.

---

## 20. Review questions for approval

1. Confirm custom roles are **org-scoped** and evaluated **in addition to** system role maps (not a full replacement of Membership.role in v1).
2. Confirm billing.manage stays **owner-only** until Phase 4 explicitly allows delegated billing managers.
3. Confirm security-critical mutations **fail closed** if audit write fails.
4. Confirm MFA remains unsupported in UI/API for Phase 5.
5. Confirm Checkpoint 1 may begin after approval of this document.

---

*Checkpoint 0 deliverable only. No governance production code in this commit beyond documentation and roadmap update.*
