# Chronos V2 — Database Audit

**Phase:** 0  
**ORM:** Mongoose 8  
**Connection:** `src/lib/mongodb/client.ts` (`MONGODB_URI`, singleton cache)

---

## Model catalog

### User — `src/lib/mongodb/models/User.ts`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| name | String | yes | |
| email | String | yes | **unique** |
| password | String | no | bcrypt at app layer; absent for Google-only users |
| avatarUrl | String | no | |
| role | String | no | enum `admin` \| `member`, default `member` |
| title | String | no | |
| isActive | Boolean | no | default `true` |
| timestamps | yes | | createdAt, updatedAt |

**Indexes:** unique email  
**Ownership:** global identity  
**Deletion:** no cascade  
**Security:** password hashes; role is app-wide (not org-scoped)

---

### UserSettings — `models/UserSettings.ts`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| userId | ObjectId→User | yes | **unique** |
| emailProvider | String | no | default gmail |
| emailAddress | String | no | |
| emailAppPassword | String | no | **plaintext secret** |
| emailFromName | String | no | |
| aiProvider / aiApiKey / aiModel / aiBaseUrl | String | no | **apiKey plaintext** |
| timestamps | yes | | |

**Security:** Encrypt at rest (Phase 1+). Phase 0 redacts secrets on GET.

---

### Project — `models/Project.ts`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| name | String | yes | |
| description | String | no | |
| status | String | no | active/paused/done |
| color | String | no | |
| ownerId | ObjectId→User | yes | |
| members | ObjectId[]→User | no | unbounded |
| dueDate | Date | no | |
| timestamps | yes | | |

**Indexes:** status; ownerId; members (Phase 0); ownerId+updatedAt (Phase 0)  
**Cascade:** app deletes tasks on project delete; docs orphaned  
**Security:** access must check owner/members/admin (enforced Phase 0)

---

### Task — `models/Task.ts`

| Field | Type | Notes |
|-------|------|-------|
| projectId | ObjectId→Project | required |
| title | String | required |
| description | String | optional |
| status | enum | todo/in_progress/review/done |
| priority | enum | low/medium/high/urgent |
| assigneeId, createdBy | ObjectId→User | optional |
| dueDate | Date | optional |
| position | Number | default 0 |
| tags | String[] | unbounded |
| timestamps | yes | |

**Indexes:** `{ projectId, status, position }`  
**Ownership:** via project membership

---

### Lead — `models/Lead.ts`

PII-heavy outreach contact. `ownerId` required. Indexes: `{ownerId,status}`, `{email,ownerId}` (not unique — duplicates possible).

---

### Workflow — `models/Workflow.ts`

Graph (`nodes`, `edges`) + nested `config` including **smtpPass / aiApiKey plaintext**. Indexed `{ownerId,status}`. Unbounded Mixed `data` on nodes.

---

### WorkflowExecution — `models/WorkflowExecution.ts`

Run state per lead. `stepHistory` may store generated email bodies. Indexes include Phase 0 `{status, nextExecutionAt}` for future worker.

---

### Chat / Message

Chat: participants[], optional admin, lastMessageAt. Phase 0 index `{participants, lastMessageAt}`.  
Message: chatId, senderId, content, readBy[]. Phase 0 index `{chatId, createdAt}`.

---

### Doc (`Document.ts`, model `Doc`)

TipTap content as Mixed. Optional projectId/authorId. Text index on title; type; isPinned+updatedAt.

---

### Announcement

Platform/tenant announcements. Indexed `{isActive, expiresAt}`. **No API wiring.**

---

### ActivityLog

actorId, action, entityType, entityId, entityTitle, metadata Mixed. Index `{createdAt:-1}` only. Phase 0 API scopes non-admins.

---

## Cross-cutting findings

| Finding | Severity | Notes |
|---------|----------|-------|
| Plaintext secrets in UserSettings & Workflow.config | P1 | Encryption deferred; GET redaction done |
| Missing uniqueness on Lead email per owner | P2 | Import can conflict |
| Orphan docs/messages/executions on parent delete | P2 | No hooks |
| Unbounded arrays / Mixed content | P2 | Need size limits at API |
| Seed schema drift | P2 | `scripts/seed.ts` inline schemas |
| No monetary fields | — | N/A |
| Unsafe DB cascades | — | App-level task delete only; generally safer than cascade-all |

---

## Recommended index backlog (not all applied)

- User: `{ isActive, role, name }`
- Task: `{ assigneeId, status }`
- Doc: `{ projectId, updatedAt }`, `{ authorId }`
- ActivityLog: `{ actorId, createdAt }`, `{ entityType, entityId }`
- Unique Lead `{ email, ownerId }` if product requires dedupe

**Applied in Phase 0 (schema declarations only; non-destructive):** Project members; Chat participants; Message chatId+createdAt; WorkflowExecution status+nextExecutionAt.
