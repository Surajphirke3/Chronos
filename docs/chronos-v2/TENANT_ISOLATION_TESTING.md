# Tenant Isolation Testing

## Automated (unit)

- `src/lib/tenancy/roles.test.ts` — role ranking / assignment
- `src/lib/tenancy/invitations.test.ts` — token hashing
- `src/lib/tenancy/isolation.test.ts` — cross-workspace project denial under enforce
- Existing Phase 0/1 `access.test.ts` regressions

## Manual staging checklist

1. Create Org A + Org B with distinct users
2. Create projects/docs/leads/workflows/chats in each
3. Attempt IDOR by swapping resource IDs and `workspaceId` in requests → 403/404
4. Revoke membership → subsequent access denied
5. Accept invitation once; replay fails
6. Expired / wrong-email invitations fail
7. Team directory shows only workspace/org members
8. After migration dry-run counts match apply counts on staging clone

## Phase 1 outstanding (unchanged)

- Live Google OAuth
- Secrets migrate against real backup
- Workflow resume cron E2E
- Staging rate-limit load test
