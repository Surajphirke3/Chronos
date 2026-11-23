# Phase 6 — Security Notes

- Credentials encrypted field on connections (encryption reuse from secrets module required before storing live tokens)
- Never return tokens to browser
- Webhook signatures + skew validation
- Tenant-scoped connection records
- No fake live OAuth
