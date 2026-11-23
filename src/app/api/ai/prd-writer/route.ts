import { resolveGroqApiKeyForUser, streamGroq } from '@/lib/ai/groq'
import { assertAiBudget, recordAiUsage } from '@/lib/ai/usage'
import { requireAiTenantContext } from '@/lib/tenancy/aiGate'
import { tenantErrorResponse } from '@/lib/tenancy/http'

const SYSTEM_PROMPT = `You are a senior product manager at a startup.
Given product details, write a complete PRD in markdown format.
Include these sections: Overview, Goals, Target Users, Core Features (MVP scope), User Stories, Technical Considerations, Success Metrics, Timeline.
Be specific and actionable. No fluff. Write in clear, professional prose.`

export async function POST(req: Request) {
  try {
    const ctx = await requireAiTenantContext()

    const budget = await assertAiBudget(ctx.userId)
    if (budget.ok === false) {
      return NextResponse.json({ error: budget.error }, { status: budget.status })
    }

    const { productName, goals, users, constraints } = await req.json()

    if (!productName) {
      return NextResponse.json({ error: 'Product name is required' }, { status: 400 })
    }

    await recordAiUsage({
      userId: ctx.userId,
      provider: 'groq',
      route: '/api/ai/prd-writer',
      outcome: 'success',
    })

    const userMessage = [
      `Product: ${productName}`,
      goals ? `Goals: ${goals}` : '',
      users ? `Target Users: ${users}` : '',
      constraints ? `Constraints: ${constraints}` : '',
    ]
      .filter(Boolean)
      .join('\n')

    const apiKey = await resolveGroqApiKeyForUser(ctx.userId)
    const stream = await streamGroq(SYSTEM_PROMPT, userMessage, apiKey)

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content || ''
          if (text) {
            controller.enqueue(encoder.encode(text))
          }
        }
        controller.close()
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    })
  } catch (error) {
    return tenantErrorResponse(error, 'PRD generation failed. Please try again.')
  }
}
