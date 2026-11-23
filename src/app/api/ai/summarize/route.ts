import { callGroq, resolveGroqApiKeyForUser } from '@/lib/ai/groq'
import { NextResponse } from 'next/server'
import { assertAiBudget, recordAiUsage } from '@/lib/ai/usage'
import { requireAiTenantContext } from '@/lib/tenancy/aiGate'
import { tenantErrorResponse } from '@/lib/tenancy/http'

const SYSTEM_PROMPT = `You are a precise summarizer for startup teams.
Given meeting notes or raw text, return a JSON object with:
- summary: 2-3 sentence overview
- decisions: string array of key decisions made
- actionItems: array of objects, each with: task (string), owner (string or null), deadline (string or null)
Output ONLY valid JSON. No markdown.`

export async function POST(req: Request) {
  try {
    const ctx = await requireAiTenantContext()

    const budget = await assertAiBudget(ctx.userId)
    if (budget.ok === false) {
      return NextResponse.json({ error: budget.error }, { status: budget.status })
    }

    const { text } = await req.json()

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }

    const apiKey = await resolveGroqApiKeyForUser(ctx.userId)
    const result = await callGroq(SYSTEM_PROMPT, text, true, apiKey)
    const parsed = JSON.parse(result)
    await recordAiUsage({
      userId: ctx.userId,
      provider: 'groq',
      route: '/api/ai/summarize',
      outcome: 'success',
    })

    return NextResponse.json(parsed)
  } catch (error) {
    return tenantErrorResponse(error, 'Summarization failed. Please try again.')
  }
}
