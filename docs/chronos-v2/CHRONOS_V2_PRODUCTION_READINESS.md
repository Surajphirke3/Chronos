# Chronos V2 — Production Readiness

**Status: NOT PRODUCTION READY**

**Start here for the live snapshot:** [`CURRENT_STATUS.md`](./CURRENT_STATUS.md)

Ready for **staging verification** of governance foundations, automation workers, and tenancy dual-read.

## Blocking for production
1. Phase 2.5 staging migration apply + MULTI_TENANT_ENFORCE approval
2. Phase 3 worker failure-recovery drill
3. Phase 4 billing runtime (mock gateway + APIs) completion and sandbox drill
4. Explicit production flag review
5. Managed Mongo backups confirmed
6. Real payment/OAuth credentials only with approval

## Safe to use in staging now (flags off by default)
- Multi-tenant app with dual-read
- Automation jobs
- Governance APIs/UI behind flags
- Knowledge base APIs behind flags
