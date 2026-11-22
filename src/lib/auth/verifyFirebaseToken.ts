/**
 * Verifies a Firebase ID token via the Identity Toolkit accounts:lookup API.
 * Uses the existing Firebase web API key — no firebase-admin dependency required.
 *
 * Docs: https://cloud.google.com/identity-platform/docs/reference/rest/v1/accounts/lookup
 */

export type VerifiedFirebaseUser = {
  email: string
  name: string
  avatar: string
  localId: string
  emailVerified: boolean
}

export async function verifyFirebaseIdToken(idToken: string): Promise<VerifiedFirebaseUser> {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  if (!apiKey) {
    throw new Error('Firebase is not configured on the server')
  }

  if (!idToken || typeof idToken !== 'string' || idToken.length < 20) {
    throw new Error('Invalid Firebase ID token')
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10000)

  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
        signal: controller.signal,
      }
    )

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      const message = data?.error?.message || 'Firebase token verification failed'
      throw new Error(message)
    }

    const user = data?.users?.[0]
    if (!user?.email) {
      throw new Error('Firebase token did not include a verified email')
    }

    return {
      email: String(user.email).toLowerCase().trim(),
      name: String(user.displayName || user.email.split('@')[0]),
      avatar: String(user.photoUrl || ''),
      localId: String(user.localId || ''),
      emailVerified: Boolean(user.emailVerified),
    }
  } finally {
    clearTimeout(timer)
  }
}
