# Phase 7 — AI Intelligence Platform Architecture

## Implemented
- Flags: `AI_PLATFORM_ENABLED`, `AI_AGENTS_ENABLED`, `KNOWLEDGE_BASES_ENABLED`
- `KnowledgeBase` + `KnowledgeDocument` (chunked text in MongoDB)
- Lexical RAG retrieval with tenant filters (`retrieveAuthorizedChunks`) — retrieved text marked `untrustedContent`
- `AiAgent` + `HumanApproval` models
- Knowledge base create/ingest API

## Deferred / limited
- Vector DB / embeddings (optional float field reserved; lexical scoring used)
- Full agent runtime loop with tools
- Approval execution pipeline
- AI analytics dashboard
- Provider abstraction beyond existing Groq routes

## Security
Cross-tenant retrieval forbidden via organizationId filters. Existing AI user quotas remain. Billing entitlement enforcement remains Phase 4 flag-gated (Phase 4 runtime incomplete).
