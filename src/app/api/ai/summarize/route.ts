import { callGroq } from '@/lib/ai/groq'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { NextResponse } from 'next/server'
import { assertAiBudget, recordAiUsage } from '@/lib/ai/usage'

const SYSTEM_PROMPT = `You are a precise summarizer for startup teams.
Given meeting notes or raw text, return a JSON object with:
- summary: 2-3 sentence overview
- decisions: string array of key decisions made
- actionItems: array of objects, each with: task (string), owner (string or null), deadline (string or null)
Output ONLY valid JSON. No markdown.`

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const budget = await assertAiBudget(session.user.id)
    if (budget.ok === false) {
      return NextResponse.json({ error: budget.error }, { status: budget.status })
    }

    const { text } = await req.json()

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }

    const result = await callGroq(SYSTEM_PROMPT, text, true)
    const parsed = JSON.parse(result)
    await recordAiUsage({
      userId: session.user.id,
      provider: 'groq',
      route: '/api/ai/summarize',
      outcome: 'success',
    })

    return NextResponse.json(parsed)
  } catch (error) {
    console.error('AI summarize error:', error)
    return NextResponse.json({ error: 'Summarization failed. Please try again.' }, { status: 500 })
  }
}
