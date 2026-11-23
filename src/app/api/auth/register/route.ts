import { connectDB } from '@/lib/mongodb/client'
import { User } from '@/lib/mongodb/models/User'
import bcrypt from 'bcryptjs'
import { NextResponse } from 'next/server'
import { checkRateLimit, getClientIp } from '@/lib/security/rateLimit'
import { parseWithSchema, registerSchema } from '@/lib/api/validation'

export async function POST(req: Request) {
  try {
    if (process.env.ALLOW_PUBLIC_REGISTRATION === 'false') {
      return NextResponse.json(
        { error: 'Public registration is disabled. Contact an administrator.' },
        { status: 403 }
      )
    }

    const ip = getClientIp(req)
    const rate = await checkRateLimit(`register:${ip}`, 10, 15 * 60 * 1000)
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Too many registration attempts. Please try again later.' },
        {
          status: 429,
          headers: { 'Retry-After': String(Math.ceil(rate.retryAfterMs / 1000) || 60) },
        }
      )
    }

    const body = await req.json()
    const parsed = parseWithSchema(registerSchema, body)
    if (parsed.ok === false) return parsed.response
    const { name, email, password } = parsed.data

    await connectDB()

    const normalizedEmail = email.toLowerCase().trim()
    const existingUser = await User.findOne({ email: normalizedEmail })
    if (existingUser) {
      // Same status family as other failures to reduce enumeration signal strength
      return NextResponse.json(
        { error: 'Unable to create account with these details' },
        { status: 400 }
      )
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: 'member',
    })

    return NextResponse.json(
      { message: 'Account created successfully', userId: user._id },
      { status: 201 }
    )
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
