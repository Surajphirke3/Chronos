# Phase 5 — Audit Logging

## Model
`AuditEvent` — append-only organization-scoped events. Distinct from product `ActivityLog`.

## Write policies
| Class | Helper | Failure behavior |
|---|---|---|
| Security-critical | `writeCriticalAudit` | Fail closed when `GOVERNANCE_AUDIT_LOGS_ENABLED=true` |
| Best-effort | `writeBestEffortAudit` | Log and continue |

Critical hooks today: custom role create/assign, ownership transfer, API key create/revoke, security policy update, data export request.

## Redaction
`redactValue` strips password/secret/token/api key style fields before persistence.

## API / UI
- `GET /api/governance/audit`
- `/settings/audit-logs`
