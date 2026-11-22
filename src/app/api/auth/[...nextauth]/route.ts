import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { NextResponse } from 'next/server'
import {
  checkRateLimit,
  getClientIp,
  hashIdentifier,
  RATE_LIMITS,
} from '@/lib/security/rateLimit'

const handler = NextAuth(authOptions)

async function guardedPOST(req: Request, ctx: { params: Promise<{ nextauth: string[] }> }) {
  const ip = getClientIp(req)
  const ipLimit = await checkRateLimit(
    `login-ip:${ip}`,
    RATE_LIMITS.loginIp.limit,
    RATE_LIMITS.loginIp.windowMs
  )
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many authentication attempts. Please try again later.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(ipLimit.retryAfterMs / 1000) || 60) },
      }
    )
  }

  // Best-effort account-aware throttle when credentials email is posted
  try {
    const clone = req.clone()
    const contentType = clone.headers.get('content-type') || ''
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const form = await clone.formData()
      const email = form.get('email')
      if (typeof email === 'string' && email.includes('@')) {
        const accountLimit = await checkRateLimit(
          `login-acct:${hashIdentifier(email)}`,
          RATE_LIMITS.loginAccount.limit,
          RATE_LIMITS.loginAccount.windowMs
        )
        if (!accountLimit.allowed) {
          return NextResponse.json(
            { error: 'Too many authentication attempts. Please try again later.' },
            { status: 429 }
          )
        }
      }
    }
  } catch {
    // Ignore body parse errors; NextAuth will handle the request
  }

  return handler(req, ctx)
}

export { handler as GET, guardedPOST as POST }
