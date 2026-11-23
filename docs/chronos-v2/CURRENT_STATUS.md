# Chronos V2 — Current Status (source of truth)

**Branch:** `feat/chronos-v2-phase-5`  
**Updated:** 2026-11-23  
**HEAD:** see `git log -1`

Use this page first. Detailed history lives in phase docs; this page is the clear snapshot.

---

## One-line verdict

**Staging-capable codebase with feature flags off · NOT production ready.**

---

## Phase status

| Phase | Code status | Staging | Production |
|---|---|---|---|
| 0 Foundation | Done | — | — |
| 1 Security & reliability | Done (ops checks remain) | Partial | No |
| 2 Multi-tenancy | Done | Migration apply pending | No (`MULTI_TENANT_ENFORCE` off) |
| 2.5 Tenancy verification | Code fixes done | DB apply / IDOR / SMTP pending | No |
| 3 Automation | Done with limitations | Worker recovery drill pending | Workers must stay disabled |
| 4 Billing | **Models only** (no APIs/UI/mock gateway runtime) | Not started | No |
| 5 Governance | **Done with limitations** (flags default off) | Flag drills pending | No |
| 6 Integrations | **Foundation** (catalog + webhook crypto; no live OAuth) | Needs credentials | No |
| 7 AI platform | **Foundation** (KB + lexical RAG; agent runtime deferred) | Flag drills pending | No |
| 8 Reliability | **Docs + helpers** | Load/backup ops pending | No |

---

## What works today (flags off)

- Org/workspace tenancy (dual-read until enforce)
- Projects, tasks, docs, outreach workflows, automation jobs dashboard
- Invitations, org/workspace settings
- Governance **code** present but disabled until env flags are set
- Knowledge base / integrations APIs present but disabled until flags

## What does **not** work yet

- Real or mock checkout / paid subscriptions (Phase 4 runtime)
- Live Slack/GitHub/etc. OAuth
- Full AI agent tool loop
- Production enforcement of tenancy or governance
- Claimed backups / DR automation

---

## Feature flags (all default **false** / unset)

| Flag | Purpose |
|---|---|
| `MULTI_TENANT_ENFORCE` | Strict workspace scoping |
| `GOVERNANCE_CUSTOM_ROLES_ENABLED` | Custom roles CRUD/assign |
| `GOVERNANCE_AUDIT_LOGS_ENABLED` | Fail-closed critical audit |
| `GOVERNANCE_API_KEYS_ENABLED` | API keys + `/api/v1/me` |
| `GOVERNANCE_SECURITY_POLICIES_ENABLED` | Org security policy enforcement |
| `GOVERNANCE_DATA_EXPORT_ENABLED` | Data export requests |
| `GOVERNANCE_ENFORCEMENT_ENABLED` | Gradual permission-layer adoption |
| `INTEGRATIONS_ENABLED` | Integration provider catalog API |
| `WEBHOOKS_ENABLED` | Webhook subsystem |
| `PUBLIC_API_ENABLED` | Public API surface (probe also needs API keys) |
| `AI_PLATFORM_ENABLED` | AI platform features |
| `AI_AGENTS_ENABLED` | Agent definitions runtime |
| `KNOWLEDGE_BASES_ENABLED` | Knowledge bases + RAG |
| `BILLING_ENABLED` / `BILLING_ENFORCE_ENTITLEMENTS` | Documented for Phase 4; runtime not shipped |

---

## Key settings routes

| Route | Notes |
|---|---|
| `/settings` | Hub + links |
| `/settings/organization` | Org profile / members |
| `/settings/workspace` | Workspace |
| `/settings/roles` | Custom roles (flag) |
| `/settings/audit-logs` | Audit (needs `audit.read`) |
| `/settings/api-keys` | API keys (flag) |
| `/settings/security` | Security policies (flag) |
| `/settings/data-governance` | Exports (flag) |
| `/platform` | Platform admin only |
| `/settings/billing` | **Not implemented** (Phase 4) |

---

## Documentation map

| Doc | Use |
|---|---|
| `CURRENT_STATUS.md` | **This file** — start here |
| `CHRONOS_V2_MASTER_PLAN.md` | Roadmap checklist |
| `CHRONOS_V2_FINAL_COMPLETION_REPORT.md` | End-of-mission report |
| `CHRONOS_V2_PRODUCTION_READINESS.md` | What blocks prod |
| `PHASE_5_*.md` | Governance detail |
| `PHASE_6_*.md` | Integrations |
| `PHASE_7_*.md` | AI platform |
| `PHASE_8_*.md` | Ops / DR / security |
| `PHASE_4_ARCHITECTURE.md` | Billing design (runtime incomplete) |
| `PHASE_3_*.md` | Automation |

---

## Verification (last recorded)

| Command | Result |
|---|---|
| `npm run test` | 107/107 |
| `npm run typecheck` | pass |
| `npm run lint` | pass (4 pre-existing warnings) |
| `npm run build` | pass |

Re-run before release decisions.

---

## Next operator actions (ordered)

1. Finish Phase 4 runtime (mock gateway → APIs → UI) on billing track  
2. Staging: `migrate:tenancy` dry-run/`--apply` on clone  
3. Staging worker failure-recovery drill  
4. Enable governance flags one-by-one in staging  
5. Explicit approval before any production flag or payment credentials  
