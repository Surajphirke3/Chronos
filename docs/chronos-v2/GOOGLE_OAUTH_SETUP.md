# Google Cloud OAuth Setup for Chronos

Chronos uses **NextAuth’s native Google provider** (OAuth 2.0).  
Firebase Authentication is **not** used for Google sign-in.

Callback path (fixed by NextAuth):

```text
{NEXTAUTH_URL}/api/auth/callback/google
```

Examples:

- Local: `http://localhost:3000/api/auth/callback/google`
- Production: `https://your-domain.com/api/auth/callback/google`

---

## 1. Create or select a Google Cloud project

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project (or select an existing one) used for Chronos authentication.

---

## 2. Configure the OAuth consent screen

1. **APIs & Services → OAuth consent screen**.
2. Choose **External** (or Internal for Workspace-only).
3. Fill app name, support email, and developer contact.
4. Add scopes at minimum:
   - `openid`
   - `email`
   - `profile`
5. Add test users while the app is in **Testing** status.

---

## 3. Authorized domains

On the consent screen / branding settings, add production domains that will host Chronos (without protocol), e.g. `example.com`.

---

## 4. Create an OAuth 2.0 Web Application client

1. **APIs & Services → Credentials → Create credentials → OAuth client ID**.
2. Application type: **Web application**.
3. Name it e.g. `Chronos Web`.

---

## 5. Authorized JavaScript origins

Add origins that serve the Chronos UI:

- `http://localhost:3000`
- `https://your-production-domain.com`

---

## 6. Authorized redirect URIs

Add exactly:

- `http://localhost:3000/api/auth/callback/google`
- `https://your-production-domain.com/api/auth/callback/google`

Do **not** use Firebase redirect URIs.

---

## 7. Local development environment

In `.env.local` (never commit secrets):

```bash
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<openssl rand -base64 32>
GOOGLE_CLIENT_ID=<from Google Cloud>
GOOGLE_CLIENT_SECRET=<from Google Cloud>
ALLOW_PUBLIC_REGISTRATION=true
```

Restart `npm run dev` after changing env vars.

If `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` are missing, the Google provider is not registered and the Google button will fail safely.

---

## 8. Production credentials

Prefer a **separate** OAuth client (or at least separate redirect URIs) for production.

Set on the host (Vercel/etc.):

```bash
NEXTAUTH_URL=https://your-production-domain.com
NEXTAUTH_SECRET=<strong unique secret>
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
ALLOW_PUBLIC_REGISTRATION=false
```

---

## 9. Deployment platform checklist

1. Env vars set (no `NEXT_PUBLIC_` for Google secrets).
2. Redirect URI matches deployed URL exactly (https, no trailing slash mismatch).
3. Consent screen published or test users listed.
4. Smoke-test: credentials login still works; Google login creates/links user.

---

## 10. Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| `redirect_uri_mismatch` | Callback URI not listed exactly in Google Cloud |
| `OAuthSignin` / config error | Missing `GOOGLE_CLIENT_ID` / `SECRET` or `NEXTAUTH_URL` |
| `AccessDenied` / custom login error | Unverified email, inactive user, or registration disabled |
| Infinite redirect | `NEXTAUTH_URL` does not match the browser origin |
| Works locally, fails in prod | Prod redirect URI / consent domain missing |

---

## Account linking behavior

- Google must report **verified email**.
- Existing Chronos user with the same email is **reused** (password hash and role preserved).
- New users are created as `role: member` only.
- OAuth claims never elevate privileges.
- When `ALLOW_PUBLIC_REGISTRATION=false`, existing users can still Google-login; first-time Google users are rejected.

See `src/lib/auth/googleAccount.ts` and `src/lib/auth/options.ts`.
