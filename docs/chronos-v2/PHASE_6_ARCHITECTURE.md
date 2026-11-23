# Phase 6 — Integrations Architecture

## Implemented foundation
- Provider registry (`src/lib/integrations/registry.ts`) with honest `liveAvailable` flags
- `IntegrationConnection` model (encrypted credential field reserved)
- `WebhookEndpoint` + `WebhookDelivery` models with unique event idempotency
- HMAC signing helpers + tests (`t=,v1=`)
- `GET /api/integrations/providers` behind `INTEGRATIONS_ENABLED`

## Not claiming live
Slack/GitHub/Google/Notion/Discord/Teams adapters are catalogued but `liveAvailable: false` until OAuth credentials exist.

## Delivery semantics
Outbound webhooks: at-least-once via durable jobs (delivery worker deferred). Replay protection via `(endpointId, eventId)` unique index and timestamp skew checks.
