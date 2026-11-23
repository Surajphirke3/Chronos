import Groq from 'groq-sdk'
import { AppError } from '@/lib/api/errors'
import { connectDB } from '@/lib/mongodb/client'
import { UserSettings } from '@/lib/mongodb/models/UserSettings'
import { decryptSecret, SecretEncryptionError } from '@/lib/security/secrets'

const clientsByKey = new Map<string, Groq>()

function getGroq(apiKey: string): Groq {
  let client = clientsByKey.get(apiKey)
  if (!client) {
    client = new Groq({ apiKey })
    clientsByKey.set(apiKey, client)
  }
  return client
}

/**
 * Prefer the user's saved AI key (BYOK), then fall back to server GROQ_API_KEY.
 */
export async function resolveGroqApiKeyForUser(userId: string): Promise<string> {
  await connectDB()
  const settings = (await UserSettings.findOne({ userId }).lean()) as {
    aiApiKey?: string
  } | null

  if (settings?.aiApiKey) {
    try {
      const userKey = decryptSecret(String(settings.aiApiKey)).trim()
      if (userKey) return userKey
    } catch (error) {
      if (error instanceof SecretEncryptionError) {
        throw new AppError(
          'Saved AI API key cannot be decrypted. Check CHRONOS_ENCRYPTION_KEY on the server.',
          503
        )
      }
      throw error
    }
  }

  const envKey = process.env.GROQ_API_KEY?.trim()
  if (envKey) return envKey

  throw new AppError(
    'No AI API key configured. Save a key in Settings (BYOK) or set GROQ_API_KEY on the server.',
    503
  )
}

export async function callGroq(
  systemPrompt: string,
  userMessage: string,
  json = false,
  apiKey?: string
): Promise<string> {
  const key = apiKey?.trim() || process.env.GROQ_API_KEY?.trim()
  if (!key) {
    throw new AppError(
      'No AI API key configured. Save a key in Settings (BYOK) or set GROQ_API_KEY on the server.',
      503
    )
  }

  const completion = await getGroq(key).chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.7,
    max_tokens: 2048,
    ...(json && { response_format: { type: 'json_object' as const } }),
  })

  return completion.choices[0]?.message?.content ?? ''
}

export async function streamGroq(systemPrompt: string, userMessage: string, apiKey?: string) {
  const key = apiKey?.trim() || process.env.GROQ_API_KEY?.trim()
  if (!key) {
    throw new AppError(
      'No AI API key configured. Save a key in Settings (BYOK) or set GROQ_API_KEY on the server.',
      503
    )
  }

  return getGroq(key).chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.7,
    max_tokens: 3000,
    stream: true,
  })
}
