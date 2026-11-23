# Phase 5 — Migration

No automatic production migration.

Recommended dry-run steps for staging:

1. Ensure indexes for new collections (Mongoose auto-create on first use in app processes).
2. Optionally upsert default `OrganizationSecurityPolicy` per org via future `migrate-governance.ts` (not required for dual-read).
3. Do not rewrite Membership roles.
4. Do not convert legacy `User.role` to `platformRole`.
5. Feature flags remain off until staging verification.
