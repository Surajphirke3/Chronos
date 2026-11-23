# Phase 6 — Webhooks

Models: `WebhookEndpoint`, `WebhookDelivery`. Signing: HMAC-SHA256 with timestamp. Unique delivery per `(endpointId, eventId)`. Flag: `WEBHOOKS_ENABLED`. Management UI deferred; signing library ready.
