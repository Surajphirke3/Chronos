# Chronos V2 — Phase 0 Changelog

**Date:** 2026-11-22

---

## What was fixed (code)

### P0 — Firebase Google authentication bypass

- **Problem:** Server trusted client-supplied email for `firebase-google` without verifying a Firebase ID token.
- **Solution:** Require `idToken`; verify via Identity Toolkit; derive email only from verified response.
- **Files:** `src/lib/auth/verifyFirebaseToken.ts`, `src/lib/auth/options.ts`, `src/app/(auth)/login/page.tsx`
- **Compatibility:** Legitimate Google sign-in continues; clients must send `idToken` (login page updated). Direct email spoofing no longer works.

### P0 — Workspace data IDOR

- **Problem:** Any authenticated user could read/mutate all projects, tasks, docs, and activity.
- **Solution:** Membership/author/admin checks; project visibility filter; task/doc gated by accessible projects.
- **Files:** `src/lib/auth/access.ts`, `api/projects/**`, `api/tasks/**`, `api/docs/**`, `api/activity/route.ts`
- **Compatibility:** Seed data already populates `members`. Projects where a user is neither owner nor member will no longer appear for that user (correct ACL). Admins retain full access.

### P0/P1 — Mass assignment

- **Problem:** PATCH/`$set: body` allowed changing `ownerId` and arbitrary fields.
- **Solution:** Field allowlists for projects, tasks, docs, workflows.
- **Files:** `access.ts`, related route handlers

### P1 — Settings secret exposure

- **Problem:** GET returned SMTP/AI secrets in plaintext JSON.
- **Solution:** Redact secrets; return `*Set` booleans; ignore blank secret updates on PUT; Settings UI updated.
- **Files:** `api/user/settings/route.ts`, `(workspace)/settings/page.tsx`
- **Note:** Encryption at rest **not** implemented.

### P1 — Middleware gaps

- Added `/messages`, `/api/chats`, `/api/user` to matcher; require `token.id`.

### P1 — AI chat SSRF / abuse surface

- Allowlisted provider hosts; rate limit; message count cap.
- **File:** `api/ai/chat/route.ts`

### P1 — Registration hardening

- Rate limit (10 / 15 min / IP)
- Min password length 8
- `ALLOW_PUBLIC_REGISTRATION=false` support
- Reduced enumeration signal on duplicate email
- Removed register field presence logging
- **Files:** `api/auth/register/route.ts`, login/register UI minLength

### P1 — Auth hygiene

- Uniform invalid credentials message
- Guard missing password (Google-only users)
- JWT role/`isActive` refresh every 5 minutes

### P1 — Reliability small fixes

- WorkflowEngine AI 30s timeout
- Lead import 5MB / 5000 row caps
- Schema indexes: Project.members, Chat participants, Message chatId+createdAt, WorkflowExecution status+nextExecutionAt
- Lazy Groq client init (`src/lib/ai/groq.ts`) so build does not require `GROQ_API_KEY` at import time
- Defer `MONGODB_URI` throw until `connectDB()` (`src/lib/mongodb/client.ts`) so `next build` works without local secrets

### Tooling

- `.env.example`
- `eslint.config.mjs`
- `npm run typecheck`, `npm run test`
- Unit tests: `src/lib/auth/access.test.ts`

---

## What was only documented

- Full multi-tenancy schema (not implemented)
- Workflow pause/resume worker / queue
- Secret encryption at rest
- Durable distributed rate limiting
- Chat N+1 fix
- Zod everywhere
- Password reset / email verification
- CI/CD, Docker, health checks
- n8n integration (confirmed missing)
- Encryption / KMS design details beyond redaction

---

## Manual verification checklist

- [ ] Google sign-in with real Firebase project
- [ ] Reject forged `signIn('firebase-google', { idToken: 'fake' })`
- [ ] Member cannot PATCH another user's project by ID
- [ ] Settings GET does not include raw app password
- [ ] Registration blocked when `ALLOW_PUBLIC_REGISTRATION=false`
- [ ] Existing projects with incomplete `members[]` audited/backfilled if needed

---

## Verification commands

```bash
npm install
npm run test
npm run typecheck
npm run lint
npm run build
```

### Verification results (2026-11-22 audit environment)

| Command | Result |
|---------|--------|
| `npm run test` | **Pass** — 10/10 ACL helper tests |
| `npm run typecheck` | **Pass** (`tsc --noEmit` exit 0) |
| `npm run lint` | **Fail (pre-existing)** — 3 errors in `AuthBackground.tsx`, `ThemeContext.tsx`, `providers.tsx` (not introduced by Phase 0); 4 warnings |
| `npm run build` | **Pass** after lazy Groq + MongoDB connect fixes |

Dependency consistency: `npm install` completed successfully against `package-lock.json`.
