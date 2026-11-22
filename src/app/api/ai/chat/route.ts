import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { ALL_PROVIDERS } from '@/lib/ai/providers'
import { checkRateLimit, getClientIp } from '@/lib/security/rateLimit'

const ALLOWED_BASE_URL_HOSTS = new Set([
  'api.groq.com',
  'api.openai.com',
  'api.sambanova.ai',
  'openrouter.ai',
  'api.together.xyz',
  'api-inference.huggingface.co',
  'localhost',
  '127.0.0.1',
])

function isAllowedBaseUrl(baseUrl: unknown): boolean {
  if (!baseUrl || typeof baseUrl !== 'string') return true // providers use their defaults
  try {
    const parsed = new URL(baseUrl)
    if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1'))) {
      return false
    }
    return ALLOWED_BASE_URL_HOSTS.has(parsed.hostname)
  } catch {
    return false
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rate = checkRateLimit(`ai-chat:${session.user.id}:${getClientIp(req)}`, 60, 60 * 1000)
    if (!rate.allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const { messages, providerId, config } = await req.json()

    if (!messages || !providerId || !config) {
      return NextResponse.json({ error: 'messages, providerId, and config are required' }, { status: 400 })
    }

    if (!Array.isArray(messages) || messages.length === 0 || messages.length > 50) {
      return NextResponse.json({ error: 'messages must be a non-empty array (max 50)' }, { status: 400 })
    }

    const provider = ALL_PROVIDERS.find((p) => p.id === providerId)
    if (!provider) {
      return NextResponse.json({ error: `Unknown provider: ${providerId}` }, { status: 400 })
    }

    if (!isAllowedBaseUrl(config.baseUrl)) {
      return NextResponse.json(
        { error: 'Provider baseUrl is not allowed. Use a supported AI provider endpoint.' },
        { status: 400 }
      )
    }

    // Prefer server env key for Groq; do not trust arbitrary client baseUrl for key injection targets
    const finalConfig = {
      ...config,
      baseUrl: config.baseUrl || provider.defaultBaseUrl,
    }
    if (providerId === 'groq' && !finalConfig.apiKey && process.env.GROQ_API_KEY) {
      finalConfig.apiKey = process.env.GROQ_API_KEY
    }

    const reply = await provider.chat(messages, finalConfig)

    return NextResponse.json({ message: reply })
  } catch (error: unknown) {
    console.error('AI chat error:', error)
    const message = error instanceof Error ? error.message : 'AI request failed'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
