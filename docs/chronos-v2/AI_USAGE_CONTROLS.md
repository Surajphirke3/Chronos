# AI Usage Controls

## Scope

All `/api/ai/*` routes:

- Per-user rate limit (`assertAiBudget`)
- Daily successful-request quota (`AI_USER_DAILY_REQUEST_QUOTA`, default 200)
- Usage events in `aiusageevents` (no prompt bodies stored)
- Provider `baseUrl` allowlist on `/api/ai/chat`

## Environment

```bash
AI_USER_DAILY_REQUEST_QUOTA=200
GROQ_API_KEY=   # server-side only; never sent to browser
```

## Future org quotas

`AiUsageEvent.userId` is the current dimension. Organization/workspace ids can be added later without changing the event shape much.

## Not claimed

Token-accurate billing and monetary pricing are out of scope. Token fields exist for future provider metrics when available.
