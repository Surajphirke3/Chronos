# Phase 8 — Deployment Runbook

1. Deploy web app with flags **off** for governance/integrations/AI platform.
2. Deploy automation worker separately (`npm run automation:worker`) with cron secrets.
3. Ensure Mongo indexes via application boot.
4. Staging: enable flags one-by-one; run IDOR and payment mock drills.
5. Do **not** enable production enforcement or real payment providers without approval.
6. Rollback: disable feature flags; redeploy previous image.
