# Rate Limiting

## Backend

MongoDB collection `ratelimitbuckets` with atomic `$inc` upserts and TTL on `expiresAt`.

Public API (async):

```ts
await checkRateLimit(key, limit, windowMs)
```

Keys are hashed. `TRUST_PROXY=true` is required before honoring `X-Forwarded-For`.

## Protected operations

| Surface | Key pattern | Default |
|---------|-------------|---------|
| Register | `register:{ip}` | 10 / 15m |
| Login IP | `login-ip:{ip}` | 30 / 15m |
| Login account | `login-acct:{emailHash}` | 10 / 15m |
| AI | `ai:{userId}` | 60 / 1m |
| Workflow execute | `wf-exec:{userId}` | 10 / 1m |
| Lead import | `lead-import:{userId}` | 10 / 1h |

Login throttling wraps `POST /api/auth/[...nextauth]`.

## Fallback

If MongoDB is unavailable, an in-process memory limiter is used for the process (documented limitation for multi-instance).

## Tests

`src/lib/security/rateLimit.test.ts` (memory window behavior + hashing).
