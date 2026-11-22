# Chronos V2 — Phase 1 Changelog

**Branch:** `feat/chronos-v2-phase-1`  
**Date:** 2026-11-22

## 1A — Google OAuth

- Replaced Firebase Auth bridge with NextAuth `GoogleProvider`
- Verified-email account linking; preserve roles; remove firebase dependency
- Docs: `GOOGLE_OAUTH_SETUP.md`

## 1B — Secret encryption

- AES-256-GCM `enc:v1:` envelopes (`src/lib/security/secrets.ts`)
- Encrypt on settings/workflow writes; decrypt in engine; redact on GET
- Migration: `npm run migrate:secrets` (dry-run default)
- Docs: `SECRET_ENCRYPTION.md`

## 1C — Durable rate limiting

- MongoDB `RateLimitBucket` + async `checkRateLimit`
- Login/register/AI/execute/import protection
- Docs: `RATE_LIMITING.md`

## 1D — AI usage controls

- `assertAiBudget` + `AiUsageEvent` logging
- Daily quota via `AI_USER_DAILY_REQUEST_QUOTA`
- Docs: `AI_USAGE_CONTROLS.md`

## 1E — Workflow reliability

- Lease-based worker + `/api/cron/workflows/resume`
- **Requires deployment cron configuration** (not auto-operational)
- Docs: `WORKFLOW_RELIABILITY.md`

## 1F — API standards

- Zod helpers; leads/messages pagination; register validation; workflow secret strip
- Docs: `API_STANDARDS.md`

## 1G — Testing & CI

- Expanded unit tests; GitHub Actions CI workflow
- Docs: `TESTING_AND_CI.md`

## 1H — Performance & readiness

- Chat list aggregation (N+1 removed)
- Indexes on Task/Doc/ActivityLog
- Workspace `error.tsx`, structured logger, `/api/health`
- Lint fixes in theme/auth background
- Docs: `PRODUCTION_READINESS.md`

## Manual verification still required

- Google Cloud OAuth live login
- Secrets migration against a real DB backup
- Cron resume end-to-end
- Staging ACL + rate-limit under load
