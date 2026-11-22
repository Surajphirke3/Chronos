import { callGroq } from '@/lib/ai/groq'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { NextResponse } from 'next/server'
import { assertAiBudget, recordAiUsage } from '@/lib/ai/usage'

const SYSTEM_PROMPT = `You are a project management expert.
Given a feature description, output a JSON object with a "tasks" array.
Each task must have: title (string), description (1-2 sentences), priority (low/medium/high/urgent), estimatedHours (number).
Output ONLY valid JSON. No markdown, no explanation.`

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const budget = await assertAiBudget(session.user.id)
    if (budget.ok === false) {
      return NextResponse.json({ error: budget.error }, { status: budget.status })
    }

    const { featureDescription, projectContext } = await req.json()

    if (!featureDescription) {
      return NextResponse.json({ error: 'Feature description is required' }, { status: 400 })
    }

    const result = await callGroq(
      SYSTEM_PROMPT,
      `Project context: ${projectContext || 'General startup project'}\n\nFeature to break down: ${featureDescription}`,
      true
    )

    const parsed = JSON.parse(result)
    await recordAiUsage({
      userId: session.user.id,
      provider: 'groq',
      route: '/api/ai/generate-tasks',
      outcome: 'success',
    })
    return NextResponse.json(parsed)
  } catch (error) {
    console.error('AI generate-tasks error:', error)
    return NextResponse.json({ error: 'AI generation failed. Please try again.' }, { status: 500 })
  }
}
