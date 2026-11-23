import { NextResponse } from 'next/server'
import { ALL_PROVIDERS } from '@/lib/ai/providers'
import { resolveServerAiConfig } from '@/lib/ai/serverProvider'
import { assertAiBudget, recordAiUsage } from '@/lib/ai/usage'
import { AppError } from '@/lib/api/errors'
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

    const body = await req.json()
    const { productName, goals, users, constraints, providerId, config } = body

    if (!productName) {
      return NextResponse.json({ error: 'Product name is required' }, { status: 400 })
    }

    const resolved = await resolveServerAiConfig(ctx.userId, { providerId, config })
    const provider = ALL_PROVIDERS.find((p) => p.id === resolved.providerId)
    if (!provider) {
      throw new AppError(`Unknown AI provider: ${resolved.providerId}`, 400)
    }

    await recordAiUsage({
      userId: ctx.userId,
      provider: resolved.providerId,
      model: resolved.config.model,
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

    let stream: ReadableStream<string>
    try {
      stream = await provider.stream(
        [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        resolved.config
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI provider request failed'
      throw new AppError(message.slice(0, 300), 502)
    }

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        const reader = stream.getReader()
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            if (value) controller.enqueue(encoder.encode(value))
          }
          controller.close()
        } catch (error) {
          controller.error(error)
        }
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
