# Chronos V2 — Repository Audit

**Phase:** 0 — Foundation & Engineering Audit  
**Date:** 2026-11-22  
**Codebase root:** `Chronos/` (application lives under this folder; workspace root also contains a nested `.git`)

---

## 1. Actual technology stack

| Layer | Technology | Version (from package.json) | Evidence |
|-------|------------|------------------------------|----------|
| Framework | Next.js App Router | 16.1.6 | `package.json` |
| UI | React | 19.2.3 | `package.json` |
| Language | TypeScript | ^5 | `tsconfig.json` (`strict: false`) |
| Styling | Tailwind CSS v4 + custom CSS vars | ^4 | `postcss.config.mjs`, `src/app/globals.css` |
| Database | MongoDB via Mongoose | ^8.23.0 | `src/lib/mongodb/client.ts` |
| Auth | NextAuth v4 (JWT) + Firebase client Google popup | next-auth ^4.24.13, firebase ^12.10.0 | `src/lib/auth/options.ts`, `src/lib/firebase.ts` |
| Validation | Zod (dependency present; **minimal API usage**) | ^4.3.6 | `package.json`; grep shows little/no route usage |
| Forms | react-hook-form + resolvers | various | dependencies |
| Client data | SWR | ^2.4.0 | hooks / pages |
| Client state | Zustand | ^5.0.11 | `src/lib/store/`, i18n |
| AI | groq-sdk + custom OpenAI-compatible providers | ^0.37.0 | `src/lib/ai/` |
| Email | nodemailer (Gmail SMTP) | ^7.0.13 | `src/lib/engine/WorkflowEngine.ts` |
| Editor | TipTap | ^3.20.0 | docs pages |
| Kanban | @dnd-kit | ^6–10 | projects/tasks UI |
| Workflow UI | @xyflow/react | ^12.10.1 | outreach builder |
| Package name | `workspasce` (typo) | 0.1.0 | `package.json` |

**Not present:** Prisma, Clerk, Vercel AI SDK, Bull/Inngest, Server Actions, Docker, CI workflows, automated E2E.

---

## 2. Directory structure

```
Chronos/
├── public/                 # static assets
├── scripts/seed.ts         # demo data seeder
├── src/
│   ├── middleware.ts       # JWT gate for protected pages/APIs
│   ├── app/
│   │   ├── (auth)/         # login, register
│   │   ├── (workspace)/    # dashboard, projects, docs, messages, team, settings, AI, outreach
│   │   ├── api/            # Route Handlers (no Server Actions)
│   │   ├── layout.tsx, page.tsx, globals.css
│   ├── components/         # landing + workspace UI (no components/ui shadcn folder)
│   └── lib/                # auth, mongodb, ai, engine, hooks, i18n, store, types
├── docs/chronos-v2/        # Phase 0 documentation (this set)
├── package.json, tsconfig.json, next.config.ts, eslint.config.mjs
└── .env.example
```

---

## 3. Architectural overview

Chronos is a **monolithic Next.js full-stack application**:

- **Presentation:** React client pages (mostly `'use client'`) with App Router route groups.
- **API:** REST-style Route Handlers under `src/app/api/**/route.ts`.
- **Persistence:** Mongoose models; connection singleton in `src/lib/mongodb/client.ts`.
- **Auth:** NextAuth JWT sessions; credentials + Firebase-verified Google bridge.
- **Outreach automation:** In-process `WorkflowEngine` invoked synchronously from HTTP (`/api/workflows/[id]/execute`).
- **Realtime:** SWR polling (not WebSockets).

There is **no organization/workspace tenancy** in the data model today. Projects use `ownerId` + `members`; outreach entities use `ownerId`.

---

## 4. Existing feature inventory

| Feature | Classification | Evidence |
|---------|----------------|----------|
| Email/password registration & login | **Implemented and verified** | `api/auth/register`, `auth/options.ts`, login/register pages |
| Google sign-in via Firebase → NextAuth | **Implemented and verified** (token verification added in Phase 0) | `login/page.tsx`, `verifyFirebaseToken.ts`, `options.ts` |
| Projects CRUD + membership | **Implemented and verified** (access scoping hardened in Phase 0) | `api/projects/**`, `models/Project.ts` |
| Tasks / Kanban | **Implemented and verified** | `api/tasks/**`, project task pages, dnd-kit |
| Documents + TipTap editor | **Implemented and verified** | `api/docs/**`, `(workspace)/docs` |
| Messaging (chat + messages) | **Implemented and verified** (polling) | `api/chats/**`, `(workspace)/messages` |
| Team directory + admin role patch | **Partially implemented** | `api/team` — list all users; PATCH admin-only; no invites |
| User settings (SMTP + AI keys) | **Implemented and verified** (secrets redacted on GET in Phase 0) | `api/user/settings`, Settings page |
| Activity feed | **Partially implemented** | `api/activity` — scoped in Phase 0; task activity still coarse |
| AI tools (summarize, PRD, generate tasks) | **Implemented and verified** | `api/ai/**`, `lib/ai/groq.ts` |
| Multi-provider AI UI | **Partially implemented** | Zustand + Settings; many routes still use env Groq only |
| Lead import (CSV/XLSX) | **Implemented and verified** | `api/leads/import` |
| Outreach workflows + execute | **Partially implemented** | Engine works for sync paths; **delay/rate-limit pause never resumes** |
| Workflow monitor / stats | **Implemented and verified** | `api/outreach/stats`, monitor page |
| Announcements | **Documented but not verified / Missing wiring** | `models/Announcement.ts` exists; dashboard uses hardcoded content |
| Notifications | **Broken or stub** | `useNotifications.ts` hard-coded; not server-backed |
| n8n / webhooks | **Missing** (README/UI claims only) | No engine webhook integration |
| File attachments | **Missing** | Roadmap only; Firebase storageBucket unused for uploads |
| Soft-delete | **Missing** | Hard deletes on projects/tasks/docs |
| Server Actions | **Missing** | README incorrect; zero `"use server"` |
| Automated tests (pre–Phase 0) | **Missing** | No test files prior to Phase 0 baseline |
| CI/CD / Docker in repo | **Missing** | README mentions Vercel; no workflows/Dockerfile |
| Multi-tenant orgs/workspaces | **Missing** | Design only — see `MULTI_TENANCY_DESIGN.md` |
| i18n (10 languages) | **Implemented and verified** | `src/lib/i18n/` |
| Dark/light theme | **Implemented and verified** | providers + settings |
| Password reset / email verification | **Missing** | No routes or models |
| Account deactivation UX | **Partial** | `User.isActive` exists; login checks it; no admin UI verified |

---

## 5. Technical debt

1. Package name typo: `workspasce`.
2. `tsconfig` `strict: false`.
3. Zod installed but unused on most APIs.
4. README drift (n8n, Server Actions, streaming AI SDK, soft-delete, `.env.example` previously missing, LICENSE linked but absent).
5. Dual AI stacks (`groq.ts`, `providers.ts`, `WorkflowEngine.callAI`).
6. Dual credential storage (`UserSettings` + `Workflow.config`).
7. Seed script uses inline schemas divergent from production models.
8. Large UI modules (workflow builder ~1000+ lines).
9. In-memory rate limiter (process-local).
10. Secrets historically stored/returned in plaintext (mitigated on GET in Phase 0; encryption still pending).

---

## 6. Deprecated or unused dependencies

| Dependency | Notes |
|------------|-------|
| `shadcn` (CLI package) | Present as dependency; `components/ui` folder absent |
| `@types/papaparse` | Types package while papaparse is used — OK |
| Firebase `storageBucket` | Configured; no upload/download code uses it |
| `detectOptOut` in SafetyGuards | Defined, never called |

No confirmed abandoned major frameworks; primary issue is **documented features not in code**.

---

## 7. Architectural inconsistencies

- Shared-team UX vs per-project `members` arrays (global list APIs previously ignored membership — fixed Phase 0).
- README architecture diagram references `src/lib/db.ts` — actual file is `mongodb/client.ts`.
- Outreach is user-scoped (`ownerId`); projects were effectively global — inconsistent tenancy story.
- Auth middleware matcher previously omitted `/messages`, `/api/chats`, `/api/user` (fixed Phase 0).

---

## 8. Unverified implementation areas

| Area | Why unverified |
|------|----------------|
| Production MongoDB indexes applied | Schema declares indexes; Atlas autoIndex behavior depends on deploy settings |
| Firebase Identity Toolkit verify in all environments | Code path added; requires valid `NEXT_PUBLIC_FIREBASE_API_KEY` |
| Gmail SMTP send in production | Simulated when settings missing; live send needs real App Password |
| Vercel deployment health / timeouts under bulk execute | No load test in Phase 0 |
| Existing production data membership completeness | Membership filter may hide projects whose `members` were never populated |

---

## 9. Environment variables (names only)

See `.env.example`. Referenced in code:

- `MONGODB_URI`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL` (NextAuth), `GROQ_API_KEY`
- `NEXT_PUBLIC_FIREBASE_*` (six public Firebase keys)
- `ALLOW_PUBLIC_REGISTRATION` (Phase 0 gate)
- Documented optionally: `NEXT_PUBLIC_APP_URL`
