# Chronos V2 — Phase 4 Architecture: Billing, Subscriptions & Usage Metering

**Branch:** `feat/chronos-v2-phase-4`  
**Date:** 2026-11-23  
**Status:** **APPROVED** (2026-11-23) — MockRazorpay first; no real Razorpay SDK/credentials; Free bootstrap; enforce flag off  
**Implementation progress:** Checkpoint 1 models committed (`Plan`, `Subscription`, payments, etc.). **Runtime not shipped** (no MockRazorpay provider, billing APIs, `/settings/billing`, or usage aggregates yet). See [`CURRENT_STATUS.md`](./CURRENT_STATUS.md).  
**Prerequisite:** Phase 3 automation available. Phase 2.5 staging migration still operational.

### Approved decisions (locked)

| Topic | Decision |
|---|---|
| Provider | Razorpay-first abstraction; **MockRazorpayProvider** in this phase; real `razorpay.provider.ts` deferred; Manual enterprise adapter allowed; **no Stripe** |
| SDK / credentials | **Do not** install Razorpay SDK; **do not** require gateway credentials; no real charges |
| Mutations | Org **owner** only |
| Reads | Org **admin** (and owner); members/guests denied by default |
| Platform admin | `User.platformRole` only — separate from org billing |
| New orgs | **Free** plan; **no** automatic trial; trials explicit |
| Enforcement | `BILLING_ENFORCE_ENTITLEMENTS=false` by default; no silent lockouts |
| Invoices | Provider references + verified metadata only; **no** GST tax invoices / custom tax math |
| Money | **INR**; store amounts as **integer minor units** (paise) |
| Activation | Server-authoritative only; client redirect never activates subscription |

---

## 1. Existing billing-related implementation (discovered)

### What does **not** exist

| Area | Finding |
|---|---|
| Payment SDKs | No `stripe`, `razorpay`, or other billing packages in `package.json` |
| Models | No Plan, Subscription, Invoice, Payment, BillingCustomer, WebhookEvent collections |
| APIs | No `/api/billing/*` or `/api/webhooks/billing/*` |
| UI | No `/settings/billing`; org settings cover name/members/invites only |
| Env | No Stripe/Razorpay keys in `.env.example` |
| Commercial enforcement | Landing `Pricing.tsx` tiers are **marketing copy only** (seats/projects/storage not enforced) |

### What **does** exist (commercial-adjacent)

| Component | Location | Scope | Notes |
|---|---|---|---|
| AI daily quota | `src/lib/ai/usage.ts` → `assertAiBudget(userId)` | **Per-user**, UTC day | Env `AI_USER_DAILY_REQUEST_QUOTA` (default 200); counts successful `AiUsageEvent` |
| AI usage events | `AiUsageEvent` model | userId + day + tokens | **No** `organizationId` / `workspaceId`; 90-day TTL |
| AI rate limit | Same function + `RATE_LIMITS.ai` | Per-user 60/min | Abuse control, not plan tier |
| Durable rate limits | `src/lib/security/rateLimit.ts` | Keyed strings (user/IP) | Register/login/AI/workflow/leads/invites |
| In-memory workflow caps | `src/lib/engine/RateLimiter.ts` | Per `ownerId` 50/hr 200/day | Not durable; competes with HTTP rate limit |
| Lead import caps | `leads/import` | 5 MB / 5000 rows + rate limit | Operational, not plan-based |
| Job create rate | `/api/jobs` | 30/min per user | Ops safeguard |
| Organization | `Organization` model | Legal/tenant boundary | Fields: name, slug, status, settings (Mixed), migrationKey — **no billing fields** |
| Org roles | `Membership` | owner / admin / member | Owner natural billing admin; admin can manage settings today |
| Platform admin | `User.platformRole === 'platform_admin'` | Platform-only | Separate from org billing |
| Activity log | `ActivityLog` | Optional org/workspace | Reusable audit trail; no billing actions yet |
| SMTP | `src/lib/tenancy/mail.ts` | Invitations etc. | Can notify payment failures / receipts later |
| Job engine (Phase 3) | `src/lib/automation/*` | Durable jobs | Suitable for webhook replay / usage aggregation — **not** for marking payments paid without verified sync path |

### Master plan alignment

- `MULTI_TENANCY_DESIGN.md` / `CHRONOS_V2_MASTER_PLAN.md`: Organization is the preferred billing boundary (was marked uncertain; Phase 4 **locks** this).
- Current master-plan “Phase 4” is a mixed product-expansion list; this architecture **elevates monetization** as the Phase 4 delivery while keeping other expansion items out of scope unless explicitly pulled in.

---

## 2. Proposed billing architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  UI: /settings/billing (+ platform admin billing console)       │
└────────────────────────────┬────────────────────────────────────┘
                             │ authenticated, active org context
┌────────────────────────────▼────────────────────────────────────┐
│  Billing APIs (Route Handlers)                                  │
│  plans / subscription / checkout / portal / cancel / change-plan│
│  usage / invoices / payments                                    │
└──────────────┬─────────────────────────────┬────────────────────┘
               │                             │
┌──────────────▼──────────────┐   ┌──────────▼────────────────────┐
│  Entitlement service        │   │  Provider adapter             │
│  getOrgSubscription()       │   │  BillingProvider interface    │
│  checkEntitlement()         │   │  RazorpayProvider (v1)        │
│  checkUsageLimit()          │   │  ManualEnterpriseProvider     │
│  assertFeatureAccess()      │   │  (StripeAdapter stub optional)│
└──────────────┬──────────────┘   └──────────┬────────────────────┘
               │                             │
┌──────────────▼──────────────┐   ┌──────────▼────────────────────┐
│  Usage metering             │   │  Webhook ingress              │
│  UsageEvent (idempotent)    │   │  verify signature → store     │
│  UsageAggregate (period)    │   │  BillingProviderEvent unique  │
│  bridges AiUsageEvent       │   │  reconcile → Subscription     │
└─────────────────────────────┘   └───────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│  MongoDB: Plan, Subscription, SubscriptionEvent,                │
│  BillingCustomer, Invoice, Payment, BillingWebhookEvent,        │
│  UsageEvent, UsageAggregate, EntitlementOverride                │
└─────────────────────────────────────────────────────────────────┘
```

**Principles**

1. Organization owns the subscription; workspaces inherit entitlements.
2. Entitlements ≠ RBAC (billing does not grant workspace roles).
3. Server-side enforcement only; UI is informative.
4. Provider abstraction; **one live provider first**.
5. Never trust browser redirect or client-submitted “payment success”.
6. Never store PAN/CVV; store provider references only.
7. New commercial quotas are **feature-flagged** and grandfather existing orgs until explicit cutover.
8. Reuse Phase 1 AI user quota as a floor until org metering is rolled out; then compose org + user limits.

---

## 3. Organization billing ownership

| Decision | Choice |
|---|---|
| Billing unit | **Organization** |
| Who manages billing | Org **`owner`** required for checkout/cancel/change-plan; org **`admin`** may view subscription + usage + invoices |
| Who cannot | Workspace-only members/guests; non-members; other orgs |
| Platform ops | `platform_admin` only — overrides, enterprise plans, webhook replay; never via org owner APIs |
| Active context | All billing APIs use `requireOrganizationAccess` with DB-revalidated membership; never trust client `organizationId` alone |

Subscription documents always include immutable `organizationId`. Lookups are `findOne({ organizationId, ... })` scoped — never by provider ID alone without org match after resolution.

---

## 4. Plan and entitlement model

### Plan registry (DB + code defaults)

Seed plans (placeholder pricing — **not** final commercial pricing):

| Slug | Public | Intent |
|---|---|---|
| `free` | yes | Default for new orgs; limited AI + automation |
| `starter` | yes | Small teams |
| `pro` | yes | Growth |
| `business` | yes | Higher limits + audit retention |
| `enterprise` | no (or sales-only) | Custom limits via override; manual invoicing |

Plan document fields (conceptual):

- Identity: `name`, `slug`, `description`, `displayOrder`, `isPublic`, `isActive`
- Money: `currency`, `priceMonthly`, `priceYearly`, `trialDays`, `billingIntervalOptions`
- Commercial: `features[]` (boolean flags), `entitlements` / `limits` map
- Provider: `providerPriceReferences: { razorpay?: { planIdMonthly, planIdYearly }, stripe?: {...}, manual?: true }`
- Soft delete: deactivate; never hard-delete plans referenced by subscriptions

### Entitlement categories (units + reset)

| Metric key | Unit | Typical reset | Enforcement style |
|---|---|---|---|
| `workspaces` | count | none (hard cap) | On workspace create |
| `teamMembers` | count | none | On invite accept / member add |
| `projects.active` | count | none | On project create |
| `ai.requests` | count | billing period or calendar month | Before AI routes + AI jobs |
| `ai.tokens` | tokens | same | Soft meter; hard limit optional |
| `automation.executions` | count | billing period | Job handler start / workflow execute |
| `workflows` | count | none | Workflow create |
| `schedules` | count | none | Schedule create |
| `storage.bytes` | bytes | none | Deferred until attachments Phase |
| `api.access` | boolean | n/a | Feature flag entitlement |
| `advancedReporting` | boolean | n/a | Feature flag |
| `auditHistoryDays` | days | n/a | Retention policy later |

Limits live in the Plan document and optional `EntitlementOverride` per organization (enterprise). Application code calls `checkUsageLimit(orgId, metric)` — **no scattered magic numbers in routes**.

---

## 5. Subscription lifecycle

### Statuses

`trialing` → `active` → (`past_due` → grace) → `suspended` → `canceled` / `expired`  
Also: `incomplete` (checkout started), `canceling` (cancel at period end flagged).

### Explicit transitions (server-enforced)

| From | To | Trigger |
|---|---|---|
| (none) | `trialing` | Org create / first billing bootstrap if trialDays > 0 |
| (none) | `active` | Verified payment / free plan activation |
| `trialing` | `active` | Checkout success webhook / verified provider fetch |
| `trialing` | `expired` | trialEnd passed without payment |
| `active` | `active` | Renewal, upgrade, downgrade (period fields update) |
| `active` | `canceling` | cancelAtPeriodEnd=true |
| `canceling` | `canceled` | period end |
| `active` | `past_due` | invoice.payment_failed |
| `past_due` | `active` | payment recovered within grace |
| `past_due` | `suspended` | gracePeriodEnd passed |
| `suspended` | `active` | Reactivation + verified payment |
| `*` | `canceled` | Immediate cancel where provider supports + policy allows |

Every transition appends `SubscriptionEvent` (immutable audit). Never overwrite history.

### Fields (Subscription)

`organizationId`, `planId`, `status`, `provider`, `providerCustomerId`, `providerSubscriptionId`, `billingInterval`, `currency`, period start/end, trial start/end, `cancelAtPeriodEnd`, `cancelledAt`, `gracePeriodEnd`, `metadata`, timestamps.

**One active subscription per organization** (unique index on `organizationId` where status ∈ active-like set, or single-doc upsert pattern with historical events).

---

## 6. Payment provider abstraction

```ts
interface BillingProvider {
  readonly id: 'razorpay' | 'stripe' | 'manual'
  createCustomer(input: CreateCustomerInput): Promise<ProviderCustomer>
  createCheckoutSession(input: CheckoutInput): Promise<{ url: string; providerSessionId: string }>
  cancelSubscription(input: CancelInput): Promise<ProviderSubscription>
  updateSubscription(input: ChangePlanInput): Promise<ProviderSubscription>
  fetchSubscription(providerSubscriptionId: string): Promise<ProviderSubscription>
  fetchInvoice(providerInvoiceId: string): Promise<ProviderInvoice>
  verifyWebhook(req: { rawBody: Buffer; headers: Headers }): Promise<VerifiedProviderEvent>
}
```

### Recommended provider for v1: **Razorpay**

| Factor | Assessment |
|---|---|
| Deployment / market | Chronos appears India-oriented (SMTP/ops patterns; README historically mentioned Stripe aspirationally) |
| Subscriptions | Razorpay Subscriptions + hosted payment pages / payment links |
| Compliance | Card data stays with Razorpay; Chronos stores IDs only |
| Complexity | Fewer moving parts than dual Stripe+Razorpay |
| Enterprise | **Manual** provider for custom invoices (no card) |

**Stripe** remains an optional second adapter behind the same interface when international account eligibility and commercial requirements are confirmed — **not** implemented in the first payment slice.

**Feature flags (default off in production):**

```
BILLING_ENABLED=false
BILLING_PROVIDER=razorpay   # razorpay | manual
BILLING_ENFORCE_ENTITLEMENTS=false
BILLING_WEBHOOK_SECRET=     # provider webhook secret
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=        # server only
```

Sandbox/test mode only until staging reconciliation passes.

---

## 7. Usage event architecture

### Central models

**UsageEvent** (append-only, idempotent):

- `organizationId` (required)
- `workspaceId` (optional)
- `actorUserId` (optional)
- `metric` (string enum)
- `quantity` (number)
- `unit` (string)
- `idempotencyKey` (unique with organizationId)
- `source` (`api` | `worker` | `webhook` | `migration` | `system`)
- `occurredAt`
- `metadata` (non-sensitive)
- Optional link: `aiUsageEventId` when bridging Phase 1 events

**UsageAggregate**:

- `organizationId`, optional `workspaceId`
- `metric`, `periodStart`, `periodEnd`, `periodKey` (e.g. `2026-11` or subscription period id)
- `quantity`
- Unique compound on org + metric + periodKey (+ workspace if broken down)

### Bridge from AiUsageEvent

1. Keep writing `AiUsageEvent` for backward compatibility and user-level abuse quotas.
2. When `BILLING_ENABLED` and org context present, also `recordUsage({ metric: 'ai.requests', ... })` with idempotency key `ai:${aiUsageEventId}` or `ai:${userId}:${route}:${requestId}`.
3. Migration: optional backfill script (dry-run default) to attach orgIds where session context can be inferred — **best-effort**; do not invent org for orphan events.

### At-least-once metering

If the operation succeeds but usage write fails, under-counting is possible. Mitigations:

- Prefer record-after-success with retries.
- For expensive AI/automation, record via durable Job completion hooks where available.
- Do **not** claim exactly-once metering across MongoDB + external AI providers.

---

## 8. Metering and aggregation

1. `recordUsage` inserts UsageEvent (unique idempotency) then atomically `$inc` UsageAggregate.
2. Period boundaries: prefer **subscription `currentPeriodStart/End`**; fall back to UTC calendar month for free/trial without provider period.
3. Reporting APIs read aggregates; export streams events for a period (org-scoped).
4. Concurrent quota: `checkUsageLimit` reads aggregate + pending reservation optional later; v1 uses read aggregate then create resource, accepting rare race — document and add conditional updates for high-contention metrics (`ai.requests`) using findOneAndUpdate on aggregate with limit predicate where needed.

---

## 9. Entitlement enforcement strategy

Central module: `src/lib/billing/entitlements.ts` (name adaptable).

```ts
getOrganizationSubscription(organizationId)
getOrganizationEntitlements(organizationId)  // plan + overrides + status effects
checkEntitlement(organizationId, featureKey)
checkUsageLimit(organizationId, metric, delta?)
recordUsage(...)
assertFeatureAccess(organizationId, featureKey) // throws AppError 402/403
```

### Status effects

| Subscription status | Policy (default, flaggable) |
|---|---|
| `trialing` / `active` | Full plan entitlements |
| `past_due` (in grace) | Read + soft warn; block new paid-feature consumption if `BILLING_ENFORCE_ENTITLEMENTS` |
| `suspended` / `expired` / `canceled` | Free-tier entitlements or read-only per flag |
| Missing subscription | Treat as `free` plan bootstrap |

### Rollout

1. Ship models + APIs + UI with `BILLING_ENFORCE_ENTITLEMENTS=false`.
2. Continue `assertAiBudget(userId)` always (abuse floor).
3. When enforce=true in staging: org limits apply **in addition** to user daily quota.
4. Existing orgs: auto-attach `free` or grandfathered `business_legacy` override via dry-run migration — **no sudden blocks**.

Wire points (incremental):

- AI routes + `aiJobs` handlers
- Workflow create / execute / job enqueue
- Schedule create
- Workspace create
- Member invite accept
- Project create (if plan limits projects)

---

## 10. Payment reconciliation

1. Checkout creates `incomplete` subscription + provider session; returns hosted URL.
2. Success page polls `GET /api/billing/subscription` — **display only**.
3. Webhook (or server-side fetch after return) verifies signature, upserts `BillingWebhookEvent` by `providerEventId` (unique), applies transition.
4. If webhook delayed: authenticated “refresh” endpoint calls `fetchSubscription` and reconciles idempotently.
5. Invoices/Payments upserted by provider IDs; never duplicate.
6. Failed webhook processing stored with `processingStatus`; platform admin can replay.
7. Optional: enqueue Phase 3 Job `billing.webhook.replay` for retries — activation of paid status must still be driven by verified event payload, not by unverified queue alone.

---

## 11. Security model

| Risk | Control |
|---|---|
| Cross-org billing read | All queries filter `organizationId` from server context |
| Client activates plan | Forbidden; only verified provider events / server fetch |
| Webhook forgery | Signature verify on raw body; reject otherwise |
| Duplicate webhooks | Unique `providerEventId` |
| Card data in Chronos | Never collected; hosted checkout only |
| Secrets in logs | Redact keys; do not log full webhook bodies with PII |
| Member upgrades org | Require org owner (mutations) |
| Platform vs org admin | `platformRole` ≠ org role; separate admin UI/API |
| Stale membership | Revalidate via `requireOrganizationAccess` |
| Race checkout | Idempotent checkout keyed by org + plan + interval |
| GST / tax invoices | **Do not** claim tax-compliant invoices without legal review; store provider invoice links/PDFs as references |
| PCI | Hosted fields ⇒ reduced SAQ scope — **do not claim PCI certified** |

---

## 12. Migration strategy

Script: `scripts/migrate-billing.ts` (dry-run default, `--apply` explicit).

1. Ensure Plan seed documents exist.
2. For each Organization without Subscription → create `free` (or `trialing` if configured) subscription + SubscriptionEvent `bootstrap`.
3. Do **not** invent Razorpay customers until checkout.
4. Optionally extend future AiUsageEvent writes with org/workspace when context available (schema additive).
5. Before/after counts logged; idempotent on re-run.
6. Rollback: document manual deactivation of `BILLING_*` flags; do not delete financial history.

**Never** run apply against production from CI or agent automation.

---

## 13. MongoDB schema design (indexes)

### Plan
- unique `slug`
- `{ isActive: 1, isPublic: 1, displayOrder: 1 }`

### Subscription
- unique `organizationId` (one current commercial record; history via events)
- `{ providerSubscriptionId: 1 }` unique sparse
- `{ providerCustomerId: 1 }`
- `{ status: 1, currentPeriodEnd: 1 }`

### SubscriptionEvent
- `{ organizationId: 1, createdAt: -1 }`
- `{ subscriptionId: 1, createdAt: -1 }`

### BillingCustomer
- unique `{ organizationId: 1, provider: 1 }`
- unique sparse `{ provider, providerCustomerId }`

### Invoice / Payment
- unique sparse `{ provider, providerInvoiceId }` / `{ provider, providerPaymentId }`
- `{ organizationId: 1, issuedAt: -1 }`

### BillingWebhookEvent
- unique `{ provider, providerEventId }`
- `{ processingStatus: 1, createdAt: 1 }`

### UsageEvent
- unique `{ organizationId: 1, idempotencyKey: 1 }`
- `{ organizationId: 1, metric: 1, occurredAt: -1 }`
- `{ organizationId: 1, workspaceId: 1, metric: 1, occurredAt: -1 }`

### UsageAggregate
- unique `{ organizationId: 1, metric: 1, periodKey: 1, workspaceId: 1 }` (workspaceId null for org rollup)

### EntitlementOverride
- unique `{ organizationId: 1 }`

---

## 14. API design (proposed)

| Method | Path | Authz |
|---|---|---|
| GET | `/api/billing/plans` | Authenticated (public plans only unless platform admin) |
| GET | `/api/billing/subscription` | Org member+ (active org) |
| POST | `/api/billing/checkout` | Org **owner**; rate limited |
| POST | `/api/billing/portal` | Org owner (provider customer portal / managed page if available) |
| POST | `/api/billing/cancel` | Org owner |
| POST | `/api/billing/change-plan` | Org owner |
| POST | `/api/billing/refresh` | Org owner/admin — reconcile from provider |
| GET | `/api/billing/usage` | Org admin+ |
| GET | `/api/billing/invoices` | Org admin+ |
| GET | `/api/billing/payments` | Org admin+ |
| POST | `/api/webhooks/billing/[provider]` | Signature only (no session) |
| Platform | `/api/platform/billing/*` | `platform_admin` |

UI: `/settings/billing` under existing settings shell.

---

## 15. Frontend

Organization billing dashboard (real data):

1. Overview — plan, status, period, payment health  
2. Plans — from API  
3. Usage — progress against entitlements  
4. Invoices / payments  
5. Manage — upgrade/downgrade/cancel with confirmations  

Platform admin: separate surface; org owners never see it.

Follow existing Chronos settings design; no new design system; no hardcoded metrics.

---

## 16. Observability & ops

- Structured logs: `organizationId`, `subscriptionId`, `providerEventId`, `correlationId` — no secrets  
- Metrics counters: checkout started, webhook accepted/rejected/duplicate, payment failed, entitlement denied  
- Health: billing config validity (keys present when `BILLING_ENABLED`) for platform admin  
- Docs deliverables after implementation: `PHASE_4_IMPLEMENTATION.md`, `PHASE_4_BILLING_SECURITY_AUDIT.md`, `PHASE_4_USAGE_METERING.md`, `PHASE_4_PAYMENT_OPERATIONS.md`, `PHASE_4_TEST_REPORT.md`, `PHASE_4_CHANGELOG.md`

---

## 17. Implementation sequence (post-approval)

| Step | Commit theme | Notes |
|---|---|---|
| 0 | Architecture doc (this file) | **Review gate** |
| 1 | Plan + Subscription + Event models + seed | No provider SDK yet |
| 2 | Lifecycle state machine + free/trial bootstrap | Unit tests |
| 3 | Provider interface + Manual provider | Enterprise path |
| 4 | Razorpay adapter + checkout (sandbox) | Only after arch approval |
| 5 | Idempotent webhooks + invoice/payment upsert | |
| 6 | UsageEvent/Aggregate + bridge AI usage | |
| 7 | Entitlement helpers + flagged enforcement hooks | |
| 8 | Billing APIs + rate limits | |
| 9 | `/settings/billing` UI | |
| 10 | Platform billing admin | |
| 11 | Migration script dry-run + tests | |
| 12 | Docs + master plan update | |

**Hold:** installing Razorpay/Stripe SDK and wiring live webhooks until this architecture is reviewed.

---

## 18. Risks and trade-offs

| Risk / trade-off | Mitigation |
|---|---|
| Dual AI quota (user daily + org period) | Keep user quota as abuse floor; document composition |
| Razorpay vs Stripe | Start Razorpay; abstract for Stripe later |
| Marketing Pricing.tsx mismatches real plans | Update landing to match seeded plans or mark “illustrative” in same PR as seed |
| In-memory WorkflowEngine limiter | Out of Phase 4 billing scope; note debt; commercial caps via UsageAggregate |
| GST / tax invoice compliance | Provider invoices as source of truth; no homemade tax invoices |
| Entitlement races | Document; harden hot paths with conditional aggregate updates |
| Webhook dependency | Refresh/reconcile endpoint + replay tooling |
| Sudden customer lockout | `BILLING_ENFORCE_ENTITLEMENTS` default false; grandfather migration |
| Master plan Phase 4 scope creep | Monetization is this phase; attachments/SSO remain separate |

---

## 19. Known non-goals (Phase 4)

- Exact token-cost monetary billing to end customers  
- Multi-provider simultaneous charge routing  
- Workspace-level paid subscriptions  
- Collecting cards inside Chronos UI  
- Claiming PCI certification or GST-compliant self-generated tax invoices  
- Enabling `BILLING_ENABLED` in production from this branch alone  
- Replacing Phase 3 job engine semantics  

---

## 20. Review checkpoint questions

1. Confirm **Razorpay-first** (vs Stripe-first) for sandbox v1.  
2. Confirm billing mutations require **owner** (admins read-only).  
3. Confirm **free plan bootstrap** on org create vs trial-by-default.  
4. Confirm entitlement enforcement remains **flag-gated** until staging sign-off.  
5. Confirm GST: store provider invoice references only (no Chronos-generated tax invoices) for v1.

---

*No payment integration code lands until this document is reviewed and the checkpoint questions are answered.*
