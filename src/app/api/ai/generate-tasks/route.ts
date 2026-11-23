import { NextResponse } from 'next/server'
import { callServerAiChat } from '@/lib/ai/serverProvider'
import { assertAiBudget, recordAiUsage } from '@/lib/ai/usage'
import { AppError } from '@/lib/api/errors'
import { requireAiTenantContext } from '@/lib/tenancy/aiGate'
import { tenantErrorResponse } from '@/lib/tenancy/http'

const SYSTEM_PROMPT = `You are a project management expert.
Given a feature description, output a JSON object with a "tasks" array.
Each task must have: title (string), description (1-2 sentences), priority (low/medium/high/urgent), estimatedHours (number).
Output ONLY valid JSON. No markdown, no explanation.`

export async function POST(req: Request) {
  try {
    const ctx = await requireAiTenantContext()

    const budget = await assertAiBudget(ctx.userId)
    if (budget.ok === false) {
      return NextResponse.json({ error: budget.error }, { status: budget.status })
    }

    const body = await req.json()
    const { featureDescription, projectContext, providerId, config } = body

    if (!featureDescription) {
      return NextResponse.json({ error: 'Feature description is required' }, { status: 400 })
    }

    const { text, providerId: usedProvider, model } = await callServerAiChat({
      userId: ctx.userId,
      override: { providerId, config },
      json: true,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Project context: ${projectContext || 'General startup project'}\n\nFeature to break down: ${featureDescription}`,
        },
      ],
    })

    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      throw new AppError('AI returned invalid JSON. Try again or switch model.', 502)
    }

    await recordAiUsage({
      userId: ctx.userId,
      provider: usedProvider,
      model,
      route: '/api/ai/generate-tasks',
      outcome: 'success',
    })
    return NextResponse.json(parsed)
  } catch (error) {
    return tenantErrorResponse(error, 'AI generation failed. Please try again.')
  }
}
