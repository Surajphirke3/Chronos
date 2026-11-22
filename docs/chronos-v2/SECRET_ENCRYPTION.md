# Secret Encryption at Rest

## Purpose

Sensitive integration credentials are encrypted with **AES-256-GCM** before storage in MongoDB.

Protected fields:

- `UserSettings.emailAppPassword`
- `UserSettings.aiApiKey`
- `Workflow.config.smtpPass`
- `Workflow.config.aiApiKey`

API responses continue to **redact** secrets (empty string + `*Set` flags). Decrypted values are used only server-side (e.g. WorkflowEngine).

---

## Environment

```bash
# 32-byte key, base64-encoded
CHRONOS_ENCRYPTION_KEY=
```

Generate:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

- Never commit the key.
- Never expose it as `NEXT_PUBLIC_*`.
- Rotating the key requires re-encrypting all secrets (future enhancement; payload is versioned as `enc:v1:`).

---

## Envelope format

```text
enc:v1:<iv_base64url>:<ciphertext_base64url>:<tag_base64url>
```

Tampered or wrong-key payloads fail decryption with `SecretEncryptionError`.

Writing secrets **requires** a configured key. Chronos does **not** fall back to storing new plaintext if encryption fails.

Reading still accepts legacy plaintext until migration completes (`decryptSecret` passthrough for non-envelope values).

---

## Migration

```bash
# Dry-run (default) — counts only, no writes
npx tsx scripts/migrate-secrets.ts

# Apply
npx tsx scripts/migrate-secrets.ts --apply
```

### Procedure

1. **Backup** MongoDB (`usersettings`, `workflows` collections).
2. Set `CHRONOS_ENCRYPTION_KEY` in the environment used for migration.
3. Run dry-run; review counts (`userSettingsUpdated`, `workflowsUpdated`, `failures`).
4. Run `--apply`.
5. Re-run dry-run; expect `*Updated: 0` and skips for already-encrypted docs.
6. Smoke-test: save settings, run a workflow email/AI step.

### Rollback

1. Restore MongoDB backup taken before `--apply`.
2. Or keep the same key and leave encrypted values (application can decrypt).

There is no automatic decrypt-to-plaintext script (by design).

---

## Code map

| Module | Role |
|--------|------|
| `src/lib/security/secrets.ts` | encrypt/decrypt/redact helpers |
| `src/app/api/user/settings/route.ts` | encrypt on write |
| `src/app/api/workflows/**` | encrypt config secrets; redact on GET |
| `src/lib/engine/WorkflowEngine.ts` | decrypt for SMTP/AI |
| `scripts/migrate-secrets.ts` | offline migration |

---

## Tests

`src/lib/security/secrets.test.ts` — round-trip, tamper rejection, missing key, workflow helpers.
