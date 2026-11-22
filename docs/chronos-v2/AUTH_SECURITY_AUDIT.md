# Chronos V2 — Authentication & Authorization Audit

**Phase:** 0  
**Date:** 2026-11-22

---

## Authentication lifecycle

| Step | Status | Evidence |
|------|--------|----------|
| Registration | Implemented | `api/auth/register` — role forced `member`; rate limited Phase 0; min password 8 |
| Login (credentials) | Implemented | `auth/options.ts` — bcrypt; uniform error message Phase 0 |
| Login (Google) | Implemented | Firebase popup → **ID token verified server-side** (Phase 0) |
| Logout | NextAuth default | `signOut` via next-auth/react (UI usage) |
| Session creation | JWT | `session.strategy: 'jwt'` |
| Session validation | Middleware + getServerSession | `middleware.ts`, routes |
| Session expiration | NextAuth defaults | Not customized |
| Password hashing | bcrypt cost 12 | register route |
| Password reset | **Missing** | — |
| Email verification | **Missing** | — |
| OAuth (native) | Firebase bridge only | Not NextAuth Google provider |
| Cookie security | Framework defaults | Document HTTPS + NEXTAUTH_URL for prod |
| CSRF | NextAuth for auth routes | Custom REST APIs rely on SameSite |
| Brute-force protection | Partial | Register rate limit Phase 0; login still NextAuth-default |
| Account deactivation | Partial | `isActive` checked on login; JWT refresh clears inactive |
| Session revocation | Partial | No server-side session store; JWT until expiry; role refresh every 5m |

---

## Critical findings

### P0 — Firebase Google auth bypass (FIXED)

**Before:** `firebase-google` Credentials provider accepted client-supplied `email`/`name`/`avatar` with no token verification — any caller could impersonate any email.

**After:** Client sends Firebase `idToken`; server verifies via Identity Toolkit `accounts:lookup` (`src/lib/auth/verifyFirebaseToken.ts`); email taken only from verified response. Login page updated accordingly.

**Manual verification still required:** exercise Google sign-in against a real Firebase project.

### P0 — Workspace IDOR (FIXED)

Projects, tasks, docs, and activity previously returned/mutated global data for any authenticated user.

**After:**

- Projects: visibility filter owner/member/admin; PATCH owner/admin only; field allowlist
- Tasks: require accessible project
- Docs: author or accessible project (admin all)
- Activity: non-admins scoped to own actions + accessible projects

### P1 — Secrets returned to client (MITIGATED)

GET `/api/user/settings` now returns empty secret fields + `emailAppPasswordSet` / `aiApiKeySet`. PUT ignores blank/placeholder secret updates. **Encryption at rest still pending.**

### P1 — JWT role staleness (MITIGATED)

JWT callback refreshes `role` / `isActive` from DB every 5 minutes or on `trigger=update`.

### P1 — AI chat SSRF (MITIGATED)

`/api/ai/chat` allowlists provider hostnames; rate limited.

### P1 — Open registration into shared data (DOCUMENTED + GATE)

`ALLOW_PUBLIC_REGISTRATION=false` disables signup and Google auto-provision. Production should disable open registration until invites exist.

---

## Remaining issues (not fully fixed)

| Severity | Issue | Phase |
|----------|-------|-------|
| P1 | Secrets plaintext in MongoDB | 1 — encryption/KMS |
| P1 | No durable login rate limit / lockout | 1 |
| P1 | AI cost abuse via env GROQ key | 1 — quotas |
| P2 | Team directory lists all emails | Multi-tenant / privacy |
| P2 | CSRF on cookie-authenticated JSON APIs | 1 — evaluate |
| P2 | Weak password policy (length only) | 1 |
| P3 | No email verification / password reset | 1–2 |

---

## Authorization matrix (post–Phase 0)

| Resource | Read | Write | Delete |
|----------|------|-------|--------|
| Project | owner, member, admin | owner, admin | owner, admin |
| Task | project-accessible | project-accessible | project-accessible |
| Doc | author, project-accessible, admin | same | author, admin |
| Lead/Workflow | owner | owner | owner |
| Chat | participant | participant | n/a |
| Team PATCH role | — | admin | — |
| Settings | self | self | — |

---

## Positive controls

- bcrypt cost 12
- Register cannot set role
- Team PATCH admin-gated
- Chats participant checks (pre-existing)
- Outreach ownerId scoping (pre-existing)
- Middleware covers workspace APIs including chats/user (Phase 0)
