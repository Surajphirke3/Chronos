import { AppError } from '@/lib/api/errors'
import { ALL_PROVIDERS, type AIMessage, type AIProviderConfig } from '@/lib/ai/providers'
import { connectDB } from '@/lib/mongodb/client'
import { UserSettings } from '@/lib/mongodb/models/UserSettings'
import { decryptSecret, SecretEncryptionError } from '@/lib/security/secrets'

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

export function isAllowedBaseUrl(baseUrl: unknown): boolean {
  if (!baseUrl || typeof baseUrl !== 'string') return true
  try {
    const parsed = new URL(baseUrl)
    if (
      parsed.protocol !== 'https:' &&
      !(parsed.protocol === 'http:' && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1'))
    ) {
      return false
    }
    return ALLOWED_BASE_URL_HOSTS.has(parsed.hostname)
  } catch {
    return false
  }
}

export type ResolvedServerAi = {
  providerId: string
  config: AIProviderConfig
}

type ClientAiOverride = {
  providerId?: string
  config?: Partial<AIProviderConfig> & { apiKey?: string; baseUrl?: string; model?: string }
}

/**
 * Resolve provider config for server AI tools.
 * Preference: request override (UI BYOK) → saved UserSettings → GROQ_API_KEY env.
 */
export async function resolveServerAiConfig(
  userId: string,
  override?: ClientAiOverride
): Promise<ResolvedServerAi> {
  await connectDB()
  const settings = (await UserSettings.findOne({ userId }).lean()) as {
    aiProvider?: string
    aiApiKey?: string
    aiModel?: string
    aiBaseUrl?: string
  } | null

  let savedKey = ''
  if (settings?.aiApiKey) {
    try {
      savedKey = decryptSecret(String(settings.aiApiKey)).trim()
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

  const envKey = process.env.GROQ_API_KEY?.trim() || ''
  const overrideProviderId = override?.providerId?.trim()
  const overrideCfg = override?.config

  const providerId = overrideProviderId || settings?.aiProvider || 'groq'
  const provider = ALL_PROVIDERS.find((p) => p.id === providerId)
  if (!provider) {
    throw new AppError(`Unknown AI provider: ${providerId}`, 400)
  }

  const apiKey = (overrideCfg?.apiKey || savedKey || (providerId === 'groq' ? envKey : '') || '').trim()
  const baseUrl = (overrideCfg?.baseUrl || settings?.aiBaseUrl || provider.defaultBaseUrl || '').trim()
  const model = (overrideCfg?.model || settings?.aiModel || provider.defaultModel || '').trim()

  if (provider.requiresApiKey && !apiKey) {
    throw new AppError(
      'No AI API key configured. Set one in Settings / the AI provider panel, or set GROQ_API_KEY on the server.',
      503
    )
  }

  if (!model) {
    throw new AppError('AI model is required. Set a model in the provider panel.', 400)
  }

  if (baseUrl && !isAllowedBaseUrl(baseUrl)) {
    throw new AppError('Provider baseUrl is not allowed. Use a supported AI provider endpoint.', 400)
  }

  if ((providerId === 'byok' || provider.id === 'byok') && !baseUrl) {
    throw new AppError('Custom (BYOK) requires a Base URL (e.g. https://api.groq.com/openai/v1).', 400)
  }

  return {
    providerId,
    config: {
      id: providerId,
      name: provider.name,
      apiKey,
      baseUrl: baseUrl || provider.defaultBaseUrl,
      model,
      enabled: true,
    },
  }
}

export async function callServerAiChat(params: {
  userId: string
  messages: AIMessage[]
  override?: ClientAiOverride
  json?: boolean
}): Promise<{ text: string; providerId: string; model: string }> {
  const resolved = await resolveServerAiConfig(params.userId, params.override)
  const provider = ALL_PROVIDERS.find((p) => p.id === resolved.providerId)
  if (!provider) {
    throw new AppError(`Unknown AI provider: ${resolved.providerId}`, 400)
  }

  const messages = params.json
    ? [
        ...params.messages,
        {
          role: 'system' as const,
          content: 'Respond with valid JSON only. No markdown fences.',
        },
      ]
    : params.messages

  try {
    // Prefer OpenAI-compatible JSON mode when requesting structured output on groq/byok/openai-like hosts
    if (params.json && resolved.config.baseUrl) {
      const text = await openAiCompatibleJsonChat(resolved.config, messages)
      return { text, providerId: resolved.providerId, model: resolved.config.model }
    }

    const text = await provider.chat(messages, resolved.config)
    return { text, providerId: resolved.providerId, model: resolved.config.model }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI provider request failed'
    throw new AppError(message.slice(0, 300), 502)
  }
}

async function openAiCompatibleJsonChat(config: AIProviderConfig, messages: AIMessage[]): Promise<string> {
  const url = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: 0.7,
      max_tokens: 2048,
      response_format: { type: 'json_object' },
    }),
  })

  const bodyText = await res.text().catch(() => '')
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}: ${bodyText.slice(0, 200)}`)
  }

  let data: { choices?: Array<{ message?: { content?: string } }> }
  try {
    data = JSON.parse(bodyText)
  } catch {
    throw new Error('AI provider returned non-JSON response')
  }

  return data.choices?.[0]?.message?.content ?? ''
}
