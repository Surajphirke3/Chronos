import { callGroq, resolveGroqApiKeyForUser } from '@/lib/ai/groq'
import { NextResponse } from 'next/server'
import { assertAiBudget, recordAiUsage } from '@/lib/ai/usage'
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

    const { featureDescription, projectContext } = await req.json()

    if (!featureDescription) {
      return NextResponse.json({ error: 'Feature description is required' }, { status: 400 })
    }

    const apiKey = await resolveGroqApiKeyForUser(ctx.userId)
    const result = await callGroq(
      SYSTEM_PROMPT,
      `Project context: ${projectContext || 'General startup project'}\n\nFeature to break down: ${featureDescription}`,
      true,
      apiKey
    )

    const parsed = JSON.parse(result)
    await recordAiUsage({
      userId: ctx.userId,
      provider: 'groq',
      route: '/api/ai/generate-tasks',
      outcome: 'success',
    })
    return NextResponse.json(parsed)
  } catch (error) {
    return tenantErrorResponse(error, 'AI generation failed. Please try again.')
  }
}
