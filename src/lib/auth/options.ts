import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import { connectDB } from '@/lib/mongodb/client'
import { User } from '@/lib/mongodb/models/User'
import bcrypt from 'bcryptjs'
import {
  evaluateGoogleSignInPolicy,
  googleSignInErrorMessage,
  type GoogleProfileInput,
} from '@/lib/auth/googleAccount'

const googleConfigured =
  Boolean(process.env.GOOGLE_CLIENT_ID?.trim()) &&
  Boolean(process.env.GOOGLE_CLIENT_SECRET?.trim())

export const authOptions: NextAuthOptions = {
  providers: [
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
    ...(googleConfigured
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID as string,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
            authorization: {
              params: {
                prompt: 'select_account',
              },
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== 'google') {
        return true
      }

      const googleProfile = (profile || {}) as GoogleProfileInput
      const allowPublicRegistration = process.env.ALLOW_PUBLIC_REGISTRATION !== 'false'

      try {
        await connectDB()
        const normalizedEmail = googleProfile.email?.toLowerCase().trim()
        const existing = normalizedEmail
          ? await User.findOne({ email: normalizedEmail }).select('isActive role name avatarUrl')
          : null

        const decision = evaluateGoogleSignInPolicy({
          profile: googleProfile,
          existingUser: existing,
          allowPublicRegistration,
        })

        if (decision.ok === false) {
          return `/login?error=${encodeURIComponent(googleSignInErrorMessage(decision.reason))}`
        }

        if (decision.isNewUser) {
          await User.create({
            name: decision.name,
            email: decision.email,
            role: 'member',
            avatarUrl: decision.avatar || '',
          })
        } else if (existing) {
          const updates: Record<string, string> = {}
          if (decision.name && decision.name !== existing.name) updates.name = decision.name
          if (decision.avatar && decision.avatar !== existing.avatarUrl) {
            updates.avatarUrl = decision.avatar
          }
          if (Object.keys(updates).length > 0) {
            await User.findByIdAndUpdate(existing._id, updates)
          }
        }

        return true
      } catch (error) {
        console.error('Google sign-in callback failed')
        return `/login?error=${encodeURIComponent('Google sign-in failed')}`
      }
    },

    async jwt({ token, user, account, trigger }) {
      if (user) {
        // Credentials provider already supplies Chronos user id
        if (user.id && account?.provider !== 'google') {
          token.id = user.id
          token.role = (user as { role?: string }).role || 'member'
          token.roleCheckedAt = Date.now()
        }
      }

      // OAuth: resolve Mongo user by verified email on first Google sign-in
      if (account?.provider === 'google' && token.email) {
        try {
          await connectDB()
          const dbUser = await User.findOne({
            email: String(token.email).toLowerCase().trim(),
          })
            .select('role isActive')
            .lean()

          if (!dbUser || dbUser.isActive === false) {
            delete token.id
            delete token.role
          } else {
            token.id = dbUser._id.toString()
            token.role = dbUser.role || 'member'
            token.roleCheckedAt = Date.now()
          }
        } catch {
          // Keep token minimal if DB unavailable
        }
      }

      const roleCheckedAt = typeof token.roleCheckedAt === 'number' ? token.roleCheckedAt : 0
      const shouldRefreshRole =
        Boolean(token.id) && (trigger === 'update' || Date.now() - roleCheckedAt > 5 * 60 * 1000)

      if (shouldRefreshRole) {
        try {
          await connectDB()
          const dbUser = await User.findById(token.id).select('role isActive').lean()
          if (!dbUser || dbUser.isActive === false) {
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
    error: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
}

export function isGoogleOAuthConfigured(): boolean {
  return googleConfigured
}
