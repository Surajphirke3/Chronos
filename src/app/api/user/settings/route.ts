import { connectDB } from '@/lib/mongodb/client'
import { UserSettings } from '@/lib/mongodb/models/UserSettings'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { maskSecret, shouldUpdateSecret } from '@/lib/auth/access'

function sanitizeSettingsForClient(settings: Record<string, unknown> | null, fallbackEmail = '', fallbackName = '') {
  const emailSecret = maskSecret(settings?.emailAppPassword as string | undefined)
  const aiSecret = maskSecret(settings?.aiApiKey as string | undefined)

  return {
    emailProvider: settings?.emailProvider || 'gmail',
    emailAddress: settings?.emailAddress || fallbackEmail,
    emailAppPassword: '',
    emailAppPasswordSet: emailSecret.isSet,
    emailFromName: settings?.emailFromName || fallbackName,
    aiProvider: settings?.aiProvider || 'groq',
    aiApiKey: '',
    aiApiKeySet: aiSecret.isSet,
    aiModel: settings?.aiModel || 'llama-3.3-70b-versatile',
    aiBaseUrl: settings?.aiBaseUrl || '',
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const settings = await UserSettings.findOne({ userId: session.user.id }).lean() as Record<string, unknown> | null

    return NextResponse.json({
      settings: sanitizeSettingsForClient(
        settings,
        session.user.email || '',
        session.user.name || ''
      ),
    })
  } catch (error) {
    console.error('Error fetching user settings:', error)
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const {
      emailProvider, emailAddress, emailAppPassword, emailFromName,
      aiProvider, aiApiKey, aiModel, aiBaseUrl,
    } = body

    await connectDB()

    const $set: Record<string, unknown> = {
      userId: session.user.id,
    }

    if (emailProvider !== undefined) $set.emailProvider = emailProvider
    if (emailAddress !== undefined) $set.emailAddress = emailAddress
    if (emailFromName !== undefined) $set.emailFromName = emailFromName
    if (aiProvider !== undefined) $set.aiProvider = aiProvider
    if (aiModel !== undefined) $set.aiModel = aiModel
    if (aiBaseUrl !== undefined) $set.aiBaseUrl = aiBaseUrl

    // Only overwrite secrets when a real new value is provided
    if (shouldUpdateSecret(emailAppPassword)) {
      $set.emailAppPassword = String(emailAppPassword).trim()
    }
    if (shouldUpdateSecret(aiApiKey)) {
      $set.aiApiKey = String(aiApiKey).trim()
    }

    const settings = await UserSettings.findOneAndUpdate(
      { userId: session.user.id },
      { $set },
      { upsert: true, new: true }
    ).lean() as Record<string, unknown> | null

    return NextResponse.json({
      settings: sanitizeSettingsForClient(
        settings,
        session.user.email || '',
        session.user.name || ''
      ),
    })
  } catch (error) {
    console.error('Error saving user settings:', error)
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }
}
