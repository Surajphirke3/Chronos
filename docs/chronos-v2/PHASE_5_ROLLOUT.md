# Phase 5 — Rollout

Enable flags independently in staging order:

1. `GOVERNANCE_AUDIT_LOGS_ENABLED`
2. `GOVERNANCE_CUSTOM_ROLES_ENABLED`
3. `GOVERNANCE_SECURITY_POLICIES_ENABLED`
4. `GOVERNANCE_API_KEYS_ENABLED`
5. `GOVERNANCE_DATA_EXPORT_ENABLED`
6. `GOVERNANCE_ENFORCEMENT_ENABLED` last (permission checks on migrated routes)

Rollback: disable flags. Tenant isolation remains.
