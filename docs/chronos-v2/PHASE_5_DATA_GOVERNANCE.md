# Phase 5 — Data Governance

- `DataExportRequest` + job type `governance.export.run`
- Org-scoped JSON export of org/members/workspaces metadata
- Sync fallback when worker enqueue fails
- Artifacts under `.data/exports/{organizationId}/` (local; not production object storage)
- Audit records are never included in cleanup exports
- Flags: `GOVERNANCE_DATA_EXPORT_ENABLED` + policy `allowDataExport`
- Retention dry-run/apply: deferred beyond preview policy surface (export is the implemented foundation)
