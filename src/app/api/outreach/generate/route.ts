import { NextResponse } from 'next/server'
import { generateMessage } from '@/lib/ai/groqPersonalizer'
import { assertAiBudget, recordAiUsage } from '@/lib/ai/usage'
import { requireAiTenantContext } from '@/lib/tenancy/aiGate'
import { tenantErrorResponse } from '@/lib/tenancy/http'

export async function POST(req: Request) {
  try {
    const ctx = await requireAiTenantContext()
    const budget = await assertAiBudget(ctx.userId)
    if (budget.ok === false) {
      return NextResponse.json({ error: budget.error }, { status: budget.status })
    }

    const { lead, promptTemplate, tone, channel, length } = await req.json()

    if (!lead || !promptTemplate) {
      return NextResponse.json(
        { error: 'lead and promptTemplate are required' },
        { status: 400 }
      )
    }

    // Lead payload is client-supplied; this route does not load leads by ID from Mongo.
    const message = await generateMessage({ lead, promptTemplate, tone, channel, length })
    await recordAiUsage({
      userId: ctx.userId,
      provider: 'groq',
      route: '/api/outreach/generate',
      outcome: 'success',
    })

    return NextResponse.json({ message })
  } catch (error) {
    return tenantErrorResponse(error, 'Failed to generate message')
  }
}
