# Production Readiness Checklist

## Required environment

| Variable | Required | Notes |
|----------|----------|-------|
| `MONGODB_URI` | yes | |
| `NEXTAUTH_SECRET` | yes | strong random |
| `NEXTAUTH_URL` | yes | exact public origin |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | for Google login | see GOOGLE_OAUTH_SETUP.md |
| `CHRONOS_ENCRYPTION_KEY` | yes before storing secrets | 32-byte base64 |
| `ALLOW_PUBLIC_REGISTRATION` | **false** in production | until invites exist |
| `CHRONOS_CRON_SECRET` | yes for workflow resume | configure scheduler |
| `GROQ_API_KEY` | optional | server AI tools |
| `TRUST_PROXY` | true only behind trusted proxy | |
| `AI_USER_DAILY_REQUEST_QUOTA` | optional | default 200 |

## Before go-live

1. Run secrets migration dry-run then `--apply` after backup.
2. Configure Google OAuth redirect URIs.
3. Set `ALLOW_PUBLIC_REGISTRATION=false`.
4. Configure cron → `/api/cron/workflows/resume`.
5. Verify `/api/health`.
6. Smoke-test credentials login, Google login, settings save, one workflow pause/resume cycle.

## Status classification

**Requires staging verification** — not production-ready solely because the app builds.
