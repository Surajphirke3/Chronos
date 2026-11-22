# Phase 4 — Checkpoint 1: Proposed Schemas, Indexes, State Machines, Migration

**Branch:** `feat/chronos-v2-phase-4`  
**Status:** Implemented on `feat/chronos-v2-phase-4` — awaiting Checkpoint 1 review before CP2  
**Scope:** Plan, Subscription, SubscriptionEvent, BillingCustomer, CheckoutSession, Payment, Invoice, BillingProviderEvent (webhook/event ledger). Usage models land in Checkpoint 5.

Conventions match existing Mongoose models (`Schema` + `models.X || model(...)`, ObjectId refs, `timestamps`).

---

## 1. Monetary and provider conventions

| Rule | Detail |
|---|---|
| Currency | `INR` default; ISO 4217 string on records |
| Amounts | Integer **minor units** (paise). Example: ₹499.00 → `49900` |
| Provider ids | Prefixed mock ids: `mock_cust_…`, `mock_sub_…`, `mock_pay_…`, `mock_inv_…`, `mock_evt_…`, `mock_cs_…` |
| Simulation flag | `isSimulated: true` on mock payments/invoices/events — never present as live gateway settlements |
| Provider enum | `mock_razorpay` \| `manual` (\| future `razorpay`) |

---

## 2. Proposed models

### 2.1 Plan

| Field | Type | Notes |
|---|---|---|
| name | string | Display name |
| slug | string | `free` \| `starter` \| `pro` \| `business` \| `enterprise` |
| description | string | |
| currency | string | default `INR` |
| priceMonthly | number | paise; `0` for free |
| priceYearly | number | paise; `0` for free |
| billingIntervalOptions | string[] | subset of `month`, `year` |
| trialDays | number | default `0`; used only when trial explicitly started |
| features | string[] | marketing / boolean capability tags |
| entitlements | Mixed | map of metric → `{ limit, unit, period }` or boolean |
| limits | Mixed | alias/normalization of numeric caps (optional duplicate of entitlements for clarity) |
| isPublic | boolean | listed on pricing / billing UI |
| isActive | boolean | soft-disable |
| displayOrder | number | |
| providerPriceReferences | Mixed | e.g. `{ mock_razorpay: { planIdMonthly, planIdYearly }, manual: true }` |
| createdAt / updatedAt | dates | |

**Seed placeholders (not final commercial pricing):**

| slug | priceMonthly (paise) | priceYearly (paise) |
|---|---|---|
| free | 0 | 0 |
| starter | 99900 (₹999) | 999000 |
| pro | 249900 | 2499000 |
| business | 799900 | 7999000 |
| enterprise | 0 (custom) | 0 | `isPublic: false` |

Entitlement map shape (example for free):

```json
{
  "workspaces": { "limit": 1, "unit": "count", "period": "none" },
  "teamMembers": { "limit": 5, "unit": "count", "period": "none" },
  "projects.active": { "limit": 3, "unit": "count", "period": "none" },
  "ai.requests": { "limit": 100, "unit": "count", "period": "billing_period" },
  "ai.tokens": { "limit": 500000, "unit": "tokens", "period": "billing_period" },
  "automation.executions": { "limit": 50, "unit": "count", "period": "billing_period" },
  "workflow.executions": { "limit": 50, "unit": "count", "period": "billing_period" },
  "workflows": { "limit": 3, "unit": "count", "period": "none" },
  "schedules": { "limit": 2, "unit": "count", "period": "none" },
  "storage.bytes": { "limit": 1073741824, "unit": "bytes", "period": "none" },
  "integrations": { "limit": 0, "unit": "count", "period": "none" },
  "api.access": { "limit": 0, "unit": "boolean", "period": "none" },
  "advancedReporting": { "limit": 0, "unit": "boolean", "period": "none" }
}
```

(`limit: 0` on boolean metrics = disabled; `-1` = unlimited where used.)

---

### 2.2 BillingCustomer

| Field | Type | Notes |
|---|---|---|
| organizationId | ObjectId | required |
| provider | enum | `mock_razorpay` \| `manual` |
| providerCustomerId | string | required when provider issues one |
| email | string | billing contact snapshot |
| name | string | |
| metadata | Mixed | non-sensitive |
| createdAt / updatedAt | | |

One customer row per `(organizationId, provider)`.

---

### 2.3 Subscription

| Field | Type | Notes |
|---|---|---|
| organizationId | ObjectId | **unique** — one current subscription doc per org |
| planId | ObjectId | → Plan |
| planSlug | string | denormalized for queries |
| status | enum | see state machine |
| provider | enum | `mock_razorpay` \| `manual` \| `none` (free local) |
| providerCustomerId | string | optional |
| providerSubscriptionId | string | optional sparse unique |
| billingInterval | enum | `month` \| `year` \| `none` |
| currency | string | `INR` |
| unitAmount | number | paise charged per interval (0 free) |
| currentPeriodStart | Date | |
| currentPeriodEnd | Date | |
| trialStart / trialEnd | Date | optional |
| cancelAtPeriodEnd | boolean | default false |
| cancelledAt | Date | |
| gracePeriodEnd | Date | past_due grace |
| checkoutSessionId | ObjectId | optional link to pending checkout |
| metadata | Mixed | |
| createdAt / updatedAt | | |

**Statuses (Checkpoint 1 enum — locked to approved lifecycle):**

`free` | `checkout_pending` | `trialing` | `active` | `renewal_pending` | `past_due` | `suspended` | `canceling` | `canceled` | `expired`

Mapping notes:

- New org bootstrap → `free` (planSlug `free`).
- Checkout started → `checkout_pending`.
- Paid success → `active`.
- Cancel at period end → `canceling` + `cancelAtPeriodEnd=true`, then → `free` (or `canceled` then bootstrap free — prefer transition to `free` with free planId to keep one doc).
- Renewal cycle → `renewal_pending` → `active` or `past_due`.

---

### 2.4 SubscriptionEvent (immutable audit)

| Field | Type | Notes |
|---|---|---|
| organizationId | ObjectId | required |
| subscriptionId | ObjectId | required |
| type | string | e.g. `bootstrap.free`, `checkout.created`, `payment.succeeded`, `plan.changed`, `cancel.requested`, `renewal.failed` |
| fromStatus | string | |
| toStatus | string | |
| actorUserId | ObjectId | optional (system/webhook null) |
| providerEventId | string | optional link |
| payload | Mixed | redacted snapshot |
| correlationId | string | |
| createdAt | Date | no updates |

---

### 2.5 CheckoutSession

Server-authoritative checkout (required for mock hosted flow).

| Field | Type | Notes |
|---|---|---|
| organizationId | ObjectId | |
| initiatedBy | ObjectId | owner |
| planId | ObjectId | target plan |
| planSlug | string | |
| billingInterval | `month` \| `year` | |
| currency | string | |
| amount | number | paise |
| provider | enum | `mock_razorpay` |
| providerSessionId | string | unique |
| status | enum | `created` \| `pending` \| `succeeded` \| `failed` \| `cancelled` \| `expired` |
| subscriptionId | ObjectId | org subscription being upgraded |
| successPath / cancelPath | string | relative app paths |
| expiresAt | Date | |
| completedAt | Date | |
| failureReason | string | |
| simulation | Mixed | allowed outcomes metadata for mock UI (never trusted from client alone) |
| metadata | Mixed | |
| createdAt / updatedAt | | |

Client may only request allowed **simulation actions** against an owned session when `NODE_ENV !== 'production'` and `BILLING_MOCK_GATEWAY=true`; server validates and emits provider events.

---

### 2.6 Payment

| Field | Type | Notes |
|---|---|---|
| organizationId | ObjectId | |
| subscriptionId | ObjectId | |
| checkoutSessionId | ObjectId | optional |
| provider | enum | |
| providerPaymentId | string | unique with provider |
| amount | number | paise |
| currency | string | |
| status | enum | `pending` \| `succeeded` \| `failed` \| `refunded` \| `partially_refunded` |
| failureCode / failureMessage | string | |
| isSimulated | boolean | **true** for mock |
| paidAt / refundedAt | Date | |
| rawProviderStatus | string | |
| metadata | Mixed | |
| createdAt / updatedAt | | |

---

### 2.7 Invoice

| Field | Type | Notes |
|---|---|---|
| organizationId | ObjectId | |
| subscriptionId | ObjectId | |
| paymentId | ObjectId | optional |
| provider | enum | |
| providerInvoiceId | string | unique with provider |
| invoiceNumber | string | display reference (e.g. `MOCK-INV-…`) — **not** a GST tax invoice |
| amount | number | paise subtotal/total as provided |
| taxAmount | number | always `0` in mock unless provider supplies; no Chronos tax calc |
| currency | string | |
| status | enum | `draft` \| `open` \| `paid` \| `void` \| `uncollectible` |
| issuedAt / paidAt | Date | |
| invoiceDocumentReference | string | URL or provider link only |
| isSimulated | boolean | |
| metadata | Mixed | |
| createdAt / updatedAt | | |

---

### 2.8 BillingProviderEvent (idempotent ledger)

| Field | Type | Notes |
|---|---|---|
| organizationId | ObjectId | nullable until resolved |
| provider | enum | |
| providerEventId | string | **unique** with provider |
| type | string | `payment.succeeded`, `payment.failed`, `subscription.activated`, … |
| payload | Mixed | verified/simulated envelope |
| processingStatus | enum | `received` \| `processed` \| `ignored` \| `failed` |
| processingError | string | |
| processedAt | Date | |
| correlationId | string | |
| isSimulated | boolean | |
| createdAt / updatedAt | | |

Duplicate `providerEventId` → ignore (idempotent). Checkpoint 4 implements processors.

---

## 3. Indexes

| Collection | Index | Purpose |
|---|---|---|
| Plan | unique `slug` | lookup |
| Plan | `{ isActive, isPublic, displayOrder }` | catalog |
| BillingCustomer | unique `{ organizationId, provider }` | one customer/provider |
| BillingCustomer | unique sparse `{ provider, providerCustomerId }` | provider reconcile |
| Subscription | **unique** `organizationId` | one sub/org |
| Subscription | unique sparse `providerSubscriptionId` | provider reconcile |
| Subscription | `{ status, currentPeriodEnd }` | renewals / expiry jobs |
| Subscription | `{ planSlug, status }` | admin filters |
| SubscriptionEvent | `{ organizationId, createdAt: -1 }` | audit |
| SubscriptionEvent | `{ subscriptionId, createdAt: -1 }` | history |
| CheckoutSession | unique `providerSessionId` | |
| CheckoutSession | `{ organizationId, status, createdAt: -1 }` | |
| CheckoutSession | `{ status, expiresAt }` | expiry sweeper |
| Payment | unique `{ provider, providerPaymentId }` | |
| Payment | `{ organizationId, createdAt: -1 }` | |
| Invoice | unique `{ provider, providerInvoiceId }` | |
| Invoice | `{ organizationId, issuedAt: -1 }` | |
| BillingProviderEvent | unique `{ provider, providerEventId }` | dedupe |
| BillingProviderEvent | `{ processingStatus, createdAt }` | replay |

---

## 4. State machines (validated transitions)

### 4.1 Subscription status

```
free
  → checkout_pending     (owner starts checkout)
  → trialing             (explicit trial start only)

checkout_pending
  → active               (verified payment.succeeded)
  → free                 (payment.failed | checkout.cancelled | session expired)
  → checkout_pending     (retry allowed; new session)

trialing
  → active               (conversion payment or admin)
  → free                 (trial end without conversion)
  → canceling            (rare; cancel during trial → free at trialEnd)

active
  → renewal_pending      (period end approached / renewal job)
  → canceling            (cancelAtPeriodEnd)
  → checkout_pending     (upgrade/downgrade checkout)
  → past_due             (optional direct if renewal fails without pending)

renewal_pending
  → active               (renewal payment success)
  → past_due             (renewal failure)

past_due
  → active               (payment recovered within grace)
  → suspended            (gracePeriodEnd passed)
  → free                 (policy: drop to free)

suspended
  → active               (reactivation + verified payment)
  → free                 (admin / lapse policy)
  → canceled             (explicit)

canceling
  → free                 (period end; reattach free plan)
  → active               (reactivate before period end)

canceled | expired
  → free                 (normalize to free plan doc)
  → checkout_pending     (resubscribe)
```

Illegal transitions throw; every legal transition appends `SubscriptionEvent`.

### 4.2 CheckoutSession status

```
created → pending → succeeded
created → pending → failed
created → pending → cancelled
created|pending → expired
```

`succeeded` / `failed` / `cancelled` / `expired` are terminal.

### 4.3 Payment status

```
pending → succeeded | failed
succeeded → refunded | partially_refunded
```

---

## 5. Migration plan (Checkpoint 1 prepares; apply in later checkpoint)

Script: `scripts/migrate-billing.ts` (dry-run **default**; `--apply` explicit).

| Step | Action | Idempotent? |
|---|---|---|
| 1 | Upsert Plan seeds by `slug` | yes |
| 2 | For each Organization missing Subscription → create `status: free`, planSlug `free`, period = now..+30d calendar, provider `none` | yes (unique org) |
| 3 | Write `SubscriptionEvent` type `bootstrap.free` if not present for that subscription | yes (check existing type) |
| 4 | Do **not** create BillingCustomer / Payments | — |
| 5 | Print before/after counts | — |

**Safety:** never run `--apply` against production from CI/agent. `BILLING_ENABLED` remains false until staging. Enforcement flag stays false.

Checkpoint 1 implementation will add models + seed helper used by migration; **will not** auto-migrate DBs.

---

## 6. Module layout (Checkpoint 1 files)

```
src/lib/mongodb/models/
  Plan.ts
  BillingCustomer.ts
  Subscription.ts
  SubscriptionEvent.ts
  CheckoutSession.ts
  Payment.ts
  Invoice.ts
  BillingProviderEvent.ts

src/lib/billing/
  types.ts              # shared enums, money helpers
  plans/seed.ts         # placeholder plan definitions
  subscription/states.ts # transition table (used CP2+)
```

Exports via existing model import style (no barrel required unless repo already uses one).

---

## 7. Out of scope for Checkpoint 1

- Mock checkout UI / provider runtime (CP3)
- Webhook processors (CP4)
- UsageEvent / UsageAggregate (CP5)
- Entitlement enforcement hooks (CP6)
- HTTP APIs / settings UI / platform admin (CP7–9)
- Installing any payment SDK

---

## 8. Acceptance for Checkpoint 1 implementation

When approved to code:

1. Add models + indexes as above.
2. Add `src/lib/billing/types.ts` + plan seed data + transition table constants.
3. Unit tests: schema enums, unique index definitions (where testable), transition table completeness.
4. Commit: `feat(billing): add plan and subscription models`
5. Stop for Checkpoint 1 review before lifecycle bootstrap service (CP2).
