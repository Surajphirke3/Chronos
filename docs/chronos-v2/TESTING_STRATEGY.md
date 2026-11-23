# Chronos V2 — Testing Strategy

**Phase:** 0  
**Date:** 2026-11-22

---

## Existing baseline (pre–Phase 0)

| Capability | Present? |
|------------|----------|
| Unit tests | No |
| Integration / API tests | No |
| Auth / authz tests | No |
| DB tests | No |
| E2E (Playwright/Cypress) | No |
| Build verification | `next build` script |
| Lint | `eslint` script (config was missing; added Phase 0) |
| Type checking | Added `npm run typecheck` → `tsc --noEmit` |

Stack had **no test runner**. Phase 0 uses **Node.js built-in test runner** via `tsx --test` (no new test framework dependency).

---

## Minimum reliable baseline (established)

### Scripts (`package.json`)

- `npm run test` — unit tests for access-control helpers
- `npm run typecheck` — TypeScript
- `npm run lint` — ESLint (next/core-web-vitals)
- `npm run build` — production build

### Phase 0 tests

`src/lib/auth/access.test.ts` covers:

1. `canAccessProject` (owner / member / admin / deny)
2. `projectVisibilityFilter`
3. `pickAllowedFields` (blocks `ownerId` mass assignment)
4. `maskSecret` / `shouldUpdateSecret`

These prioritize **authorization and ownership validation** without requiring MongoDB.

---

## Priority test roadmap

| Priority | Area | Approach | Phase |
|----------|------|----------|-------|
| 1 | Auth register/login | API integration with test DB | 1 |
| 2 | Firebase token reject path | Mock Identity Toolkit | 1 |
| 3 | Project/task/doc IDOR | Integration | 1 |
| 4 | Settings secret redaction | API | 1 |
| 5 | Workflow owner scoping | API | 1 |
| 6 | Lead import limits | Unit/integration | 1 |
| 7 | Critical UI workflows | Playwright | 2 |
| 8 | DB model invariants | mongodb-memory-server or Atlas test DB | 1–2 |

---

## Principles

- Prefer tests against real Route Handlers over rewriting architecture for testability.
- Do not introduce Jest + Playwright + RTL all at once without CI.
- Gate CI on: `typecheck`, `test`, `lint`, `build` once environment secrets for build are available.
- Never commit real credentials; use `.env.example` names only.

---

## Known limitation

Full auth integration tests were **not** run against a live MongoDB/Firebase in Phase 0 (no local `.env` present in the audit environment). Manual verification checklist is in `PHASE_0_CHANGELOG.md`.
