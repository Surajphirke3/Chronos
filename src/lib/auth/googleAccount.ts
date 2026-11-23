/**
 * Google OAuth account resolution for Chronos.
 *
 * Linking policy (verified email only):
 * - Google must report email_verified=true before we trust the email.
 * - If a Chronos user already exists with that email, reuse that account
 *   (preserve role, password hash, ownership). Do not create a duplicate.
 * - First-time Google users are created as role=member when public registration
 *   is allowed; never inherit elevated privileges from OAuth claims.
 */

export type GoogleProfileInput = {
  email?: string | null
  name?: string | null
  picture?: string | null
  email_verified?: boolean | string | null
}

export type GoogleResolveResult =
  | { ok: true; email: string; name: string; avatar: string; isNewUser: boolean }
  | { ok: false; reason: 'unverified_email' | 'missing_email' | 'registration_disabled' | 'inactive' }

export function isGoogleEmailVerified(profile: GoogleProfileInput): boolean {
  return profile.email_verified === true || profile.email_verified === 'true'
}

export function normalizeGoogleProfile(profile: GoogleProfileInput): {
  email: string
  name: string
  avatar: string
} | null {
  if (!profile.email || typeof profile.email !== 'string') return null
  const email = profile.email.toLowerCase().trim()
  if (!email.includes('@')) return null
  return {
    email,
    name: (profile.name || email.split('@')[0] || 'User').trim(),
    avatar: typeof profile.picture === 'string' ? profile.picture : '',
  }
}

export function evaluateGoogleSignInPolicy(params: {
  profile: GoogleProfileInput
  existingUser: { isActive?: boolean } | null
  allowPublicRegistration: boolean
}): GoogleResolveResult {
  if (!isGoogleEmailVerified(params.profile)) {
    return { ok: false, reason: 'unverified_email' }
  }

  const normalized = normalizeGoogleProfile(params.profile)
  if (!normalized) {
    return { ok: false, reason: 'missing_email' }
  }

  if (params.existingUser) {
    if (params.existingUser.isActive === false) {
      return { ok: false, reason: 'inactive' }
    }
    return { ok: true, ...normalized, isNewUser: false }
  }

  if (!params.allowPublicRegistration) {
    return { ok: false, reason: 'registration_disabled' }
  }

  return { ok: true, ...normalized, isNewUser: true }
}

export function googleSignInErrorMessage(reason: Exclude<GoogleResolveResult, { ok: true }>['reason']): string {
  switch (reason) {
    case 'unverified_email':
      return 'Google email is not verified'
    case 'missing_email':
      return 'Google account did not provide an email'
    case 'registration_disabled':
      return 'Registration is disabled. Contact an administrator.'
    case 'inactive':
      return 'This account has been deactivated'
    default:
      return 'Google sign-in failed'
  }
}
