# API Standards (Phase 1)

## Helpers

- `src/lib/api/response.ts` — `apiOk` / `apiError` / status helpers
- `src/lib/api/validation.ts` — Zod parsers (`objectIdSchema`, pagination, register/project/task)
- `src/lib/api/errors.ts` — `AppError`, safe client messages

## Applied first

- Register body (Zod strict)
- Leads list pagination (`page`/`limit`, max 100)
- Chat messages cursor pagination (`limit`/`cursor`)
- Activity limit validation (array response preserved; `?meta=1` for metadata)
- Workflow GET secret redaction

## Pagination conventions

| Resource | Style | Max limit |
|----------|-------|-----------|
| Leads | page/limit | 100 |
| Messages | cursor/limit | 100 |
| Activity | limit (+ optional meta) | 100 |

## Secrets

Never return SMTP/AI secrets. Use empty string + `*Set` flags.

## Request size

Lead import: 5 MB / 5000 rows (Phase 0, preserved).
