import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { connectDB } from '@/lib/mongodb/client'
import { User } from '@/lib/mongodb/models/User'
import bcrypt from 'bcryptjs'
import { verifyFirebaseIdToken } from '@/lib/auth/verifyFirebaseToken'

export const authOptions: NextAuthOptions = {
  providers: [
    // ── Email / Password ──
    CredentialsProvider({
      id: 'credentials',
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password are required')
        }

        await connectDB()
        const user = await User.findOne({ email: credentials.email.toLowerCase().trim() })

        // Uniform message to avoid account enumeration
        const invalidCredentials = new Error('Invalid email or password')

        if (!user || !user.isActive) {
          throw invalidCredentials
        }

        if (!user.password) {
          throw invalidCredentials
        }

        const isValid = await bcrypt.compare(credentials.password, user.password)
        if (!isValid) {
          throw invalidCredentials
        }

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
        }
      },
    }),

    // ── Firebase Google Sign-In ──
    // Client must pass a Firebase ID token. The server verifies it with
    // Identity Toolkit before creating or returning a session user.
    CredentialsProvider({
      id: 'firebase-google',
      name: 'Google',
      credentials: {
        idToken: { label: 'Firebase ID Token', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.idToken) {
          throw new Error('Firebase ID token is required')
        }

        const verified = await verifyFirebaseIdToken(credentials.idToken)

        await connectDB()

        let user = await User.findOne({ email: verified.email })

        if (!user) {
          if (process.env.ALLOW_PUBLIC_REGISTRATION === 'false') {
            throw new Error('Registration is disabled. Contact an administrator.')
          }

          user = await User.create({
            name: verified.name || verified.email.split('@')[0],
            email: verified.email,
            role: 'member',
            avatarUrl: verified.avatar || '',
          })
        }

        if (!user.isActive) {
          throw new Error('This account has been deactivated')
        }

        // Keep profile fields in sync with Google when present
        const updates: Record<string, string> = {}
        if (verified.name && verified.name !== user.name) updates.name = verified.name
        if (verified.avatar && verified.avatar !== user.avatarUrl) updates.avatarUrl = verified.avatar
        if (Object.keys(updates).length > 0) {
          await User.findByIdAndUpdate(user._id, updates)
          Object.assign(user, updates)
        }

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id
        token.role = (user as { role?: string }).role || 'member'
        token.roleCheckedAt = Date.now()
      }

      // Refresh role from DB periodically so demotions take effect without waiting for full re-login
      const roleCheckedAt = typeof token.roleCheckedAt === 'number' ? token.roleCheckedAt : 0
      const shouldRefreshRole =
        Boolean(token.id) && (trigger === 'update' || Date.now() - roleCheckedAt > 5 * 60 * 1000)

      if (shouldRefreshRole) {
        try {
          await connectDB()
          const dbUser = await User.findById(token.id).select('role isActive').lean()
          if (!dbUser || dbUser.isActive === false) {
            // Force session invalidation on next request by clearing id
            delete token.id
            delete token.role
          } else {
            token.role = dbUser.role || 'member'
            token.roleCheckedAt = Date.now()
          }
        } catch {
          // Keep existing token role if DB is temporarily unavailable
        }
      }

      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
}
