# Chronos V2 — File Storage & Integrations Audit

**Phase:** 0  
**Date:** 2026-11-22

---

## File uploads

### Lead import — `api/leads/import`

| Check | Status |
|-------|--------|
| Type validation | Extension-based (`.csv`, `.xlsx`, `.xls`) — no MIME sniffing |
| Size restrictions | **Phase 0:** 5 MB max |
| Row cap | **Phase 0:** 5000 rows |
| Filename handling | Used for extension only; not written to disk |
| Private vs public | Parsed in memory; no object storage |
| Access control | Session + `ownerId` on inserts |
| Orphan handling | N/A (no stored files) |

### Other files

- No general attachment API
- Firebase `storageBucket` configured but unused
- TipTap content embeds data in Mongo Mixed field (not blob storage)

---

## Email (Nodemailer / Gmail)

| Topic | Finding |
|-------|---------|
| Secrets | App password in `UserSettings` (plaintext DB); server-side send only |
| Timeouts | nodemailer defaults; no explicit timeout |
| Failure handling | Engine catches step errors; missing config previously simulated success path |
| Logging | Simulated mode logs recipient email |

---

## AI providers

| Path | Secrets | Timeouts | Notes |
|------|---------|----------|-------|
| `lib/ai/groq.ts` | `GROQ_API_KEY` env | SDK default | Used by summarize/tasks/PRD |
| `lib/ai/providers.ts` | Client config / BYOK | 30s fetch timeout | Used by `/api/ai/chat` |
| `WorkflowEngine.callAI` | UserSettings / env | **Phase 0:** 30s AbortController | Duplicate stack |

**SSRF:** `/api/ai/chat` baseUrl allowlisted (Phase 0).  
**Cost:** Authenticated users can consume env Groq key — needs quotas.

---

## Firebase

- Client Auth for Google popup
- Server verifies ID token via Identity Toolkit (Phase 0)
- Storage unused

---

## Webhooks / n8n

- **Not implemented** despite README/UI references
- Execute API returns local engine only

---

## Recommendations

1. Encrypt UserSettings secrets; never log credentials
2. Explicit SMTP connection timeouts
3. Move workflow execution to a worker/queue
4. Implement attachment storage with signed URLs when needed
5. Remove or implement n8n claims in product docs/UI
