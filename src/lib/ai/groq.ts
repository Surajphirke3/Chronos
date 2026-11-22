import Groq from 'groq-sdk'

let groqClient: Groq | null = null

function getGroq(): Groq {
  if (!process.env.GROQ_API_KEY) {
    throw new Error(
      'GROQ_API_KEY is not configured. Set it in the environment to use server-side AI features.'
    )
  }
  if (!groqClient) {
    groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY })
  }
  return groqClient
}

export async function callGroq(
  systemPrompt: string,
  userMessage: string,
  json = false
): Promise<string> {
  const completion = await getGroq().chat.completions.create({
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

export async function streamGroq(systemPrompt: string, userMessage: string) {
  return getGroq().chat.completions.create({
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
