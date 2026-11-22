# Chronos V2 — Phase 3 Changelog

**Branch:** `feat/chronos-v2-phase-3`  
**Date:** 2026-11-23

## Added

- Durable MongoDB `Job` queue with atomic claim, leases, heartbeat, retry/DLQ
- Handler registry: `workflow.execution.resume`, `ai.document.summarize`, `ai.tasks.generate`
- Automation worker cron + optional process worker
- `AutomationSchedule` (once/interval) + scheduler cron
- Job management APIs + `/automation` dashboard (live data)
- Async workflow execute (202) with definition snapshot

## Explicit limitations

- At-least-once only (not exactly-once)
- Interval/once schedules (no cron-expr dependency)
- Production workers default **disabled**
- Full concurrency soak on staging still required

## Final status

**B. PHASE 3 COMPLETE WITH DOCUMENTED LIMITATIONS**
