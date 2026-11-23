# Phase 5 — Security Policies

Model: `OrganizationSecurityPolicy` (one per org).

Controls: invite email domains, guest access, whoCanInvite, API key creation, max key lifetime, data export allow, workspace creation restriction.

**MFA:** `mfa.status = unsupported` always. No fake toggle. PATCH rejects MFA configuration.

Enforcement hooks: invitation create (domains + guest). Flag: `GOVERNANCE_SECURITY_POLICIES_ENABLED`.

UI: `/settings/security`
