import { NextResponse } from 'next/server'
import { callServerAiChat } from '@/lib/ai/serverProvider'
import { assertAiBudget, recordAiUsage } from '@/lib/ai/usage'
import { AppError } from '@/lib/api/errors'
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

    const body = await req.json()
    const { text, providerId, config } = body

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }

    const result = await callServerAiChat({
      userId: ctx.userId,
      override: { providerId, config },
      json: true,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text },
      ],
    })

    let parsed: unknown
    try {
      parsed = JSON.parse(result.text)
    } catch {
      throw new AppError('AI returned invalid JSON. Try again or switch model.', 502)
    }

    await recordAiUsage({
      userId: ctx.userId,
      provider: result.providerId,
      model: result.model,
      route: '/api/ai/summarize',
      outcome: 'success',
    })

    return NextResponse.json(parsed)
  } catch (error) {
    return tenantErrorResponse(error, 'Summarization failed. Please try again.')
  }
}
