import { connectDB } from '@/lib/mongodb/client'
import { User } from '@/lib/mongodb/models/User'
import bcrypt from 'bcryptjs'
import { NextResponse } from 'next/server'
import { checkRateLimit, getClientIp } from '@/lib/security/rateLimit'

export async function POST(req: Request) {
  try {
    if (process.env.ALLOW_PUBLIC_REGISTRATION === 'false') {
      return NextResponse.json(
        { error: 'Public registration is disabled. Contact an administrator.' },
        { status: 403 }
      )
    }

    const ip = getClientIp(req)
    const rate = checkRateLimit(`register:${ip}`, 10, 15 * 60 * 1000)
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
    const { name, email, password } = body

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Name, email, and password are required' },
        { status: 400 }
      )
    }

    if (typeof password !== 'string' || password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      )
    }

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
      name: String(name).trim(),
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
