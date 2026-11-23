# Testing and CI

## Local commands

```bash
npm run test
npm run typecheck
npm run lint
npm run build
```

## Test runner

Node.js built-in test runner via `tsx --test "src/**/*.test.ts"`.

Coverage areas added in Phase 1:

- Google account linking policy
- Secret encryption
- Rate limiter memory windows
- Execution worker export invariants
- Existing ACL helpers (Phase 0)

## CI

`.github/workflows/ci.yml` runs on push/PR:

1. `npm ci`
2. typecheck
3. test
4. lint (`continue-on-error: true` until fully clean in all environments)
5. production build with placeholder env vars

No production secrets are stored in the workflow.
