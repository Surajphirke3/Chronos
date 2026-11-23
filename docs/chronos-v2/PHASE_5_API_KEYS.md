# Phase 5 — API Keys

- Model: `ApiKey` with `secretHash` (SHA-256 + pepper), `keyPrefix`, scopes ⊂ permission catalog.
- Owner-only permissions cannot be scoped onto keys.
- Secret shown once at creation; never returned again.
- Auth: `Authorization: Bearer chronos_…` via `authenticateBearerApiKey`.
- Probe: `GET /api/v1/me` (API key only).
- Flag: `GOVERNANCE_API_KEYS_ENABLED` (default false).
- UI: `/settings/api-keys`
