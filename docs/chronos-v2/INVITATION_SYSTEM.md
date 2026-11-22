# Invitation System

## Security properties

- Cryptographically random tokens (`base64url`, 32 bytes)
- Only SHA-256 `tokenHash` stored
- Expiry required; revocable; single-use accept via atomic `findOneAndUpdate`
- Email must match signed-in user
- Rate limited create/accept
- Email failure → invitation revoked; API returns error (never silent success)
- Tokens never logged

## APIs

- `GET/POST /api/invitations`
- `POST /api/invitations/preview`
- `POST /api/invitations/accept`
- `POST /api/invitations/:id/revoke`

## Email

Requires `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, optional `SMTP_FROM`, plus `NEXTAUTH_URL` for invite links.
