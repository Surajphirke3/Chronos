# Phase 8 — Disaster Recovery

**Do not claim backups exist unless infrastructure provides them.**

Recommended runbook:
1. MongoDB continuous backups / snapshots (operator-owned)
2. Restore to staging clone and run `migrate:tenancy` dry-run
3. Replay DLQ / failed jobs via automation dashboard
4. Reconcile billing mock events if needed
5. Rotate leaked API keys / webhook secrets
