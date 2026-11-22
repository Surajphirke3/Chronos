import { callGroq } from '@/lib/ai/groq'
import { assertAiBudget, recordAiUsage } from '@/lib/ai/usage'
import type { JobHandler } from '@/lib/automation/registry/handlers'
import { AutomationError } from '@/lib/automation/types'

/**
 * Background summarize — uses client-supplied text only (no cross-tenant DB fetch).
 * Tenant context is required for attribution and enforce-mode membership.
 */
export const aiDocumentSummarizeHandler: JobHandler = async (ctx, payload) => {
  const text = typeof payload.text === 'string' ? payload.text : ''
  if (!text.trim()) throw new AutomationError('text is required', 'permanent')
  if (text.length > 100_000) throw new AutomationError('text too large', 'permanent')

  const budget = await assertAiBudget(ctx.initiatedBy)
  if (budget.ok === false) {
    throw new AutomationError(budget.error, 'transient')
  }

  try {
    const SYSTEM_PROMPT = `You are a precise summarizer for startup teams.
Given meeting notes or raw text, return a JSON object with:
- summary: 2-3 sentence overview
- decisions: string array of key decisions made
- actionItems: array of objects, each with: task (string), owner (string or null), deadline (string or null)
Output ONLY valid JSON. No markdown.`

    const result = await callGroq(SYSTEM_PROMPT, text, true)
    const parsed = JSON.parse(result)
    await recordAiUsage({
      userId: ctx.initiatedBy,
      provider: 'groq',
      route: 'job:ai.document.summarize',
      outcome: 'success',
    })
    return { result: { summary: parsed } }
  } catch (error) {
    await recordAiUsage({
      userId: ctx.initiatedBy,
      provider: 'groq',
      route: 'job:ai.document.summarize',
      outcome: 'error',
    })
    throw new AutomationError(
      error instanceof Error ? error.message : 'AI summarize failed',
      'transient'
    )
  }
}

export const aiTasksGenerateHandler: JobHandler = async (ctx, payload) => {
  const featureDescription =
    typeof payload.featureDescription === 'string' ? payload.featureDescription : ''
  if (!featureDescription.trim()) {
    throw new AutomationError('featureDescription is required', 'permanent')
  }

  const budget = await assertAiBudget(ctx.initiatedBy)
  if (budget.ok === false) {
    throw new AutomationError(budget.error, 'transient')
  }

  const projectContext =
    typeof payload.projectContext === 'string' ? payload.projectContext : 'General startup project'

  try {
    const SYSTEM_PROMPT = `You are a project management expert.
Given a feature description, output a JSON object with a "tasks" array.
Each task must have: title (string), description (1-2 sentences), priority (low/medium/high/urgent), estimatedHours (number).
Output ONLY valid JSON. No markdown, no explanation.`

    const result = await callGroq(
      SYSTEM_PROMPT,
      `Project context: ${projectContext}\n\nFeature to break down: ${featureDescription}`,
      true
    )
    const parsed = JSON.parse(result)
    await recordAiUsage({
      userId: ctx.initiatedBy,
      provider: 'groq',
      route: 'job:ai.tasks.generate',
      outcome: 'success',
    })
    return { result: parsed }
  } catch (error) {
    await recordAiUsage({
      userId: ctx.initiatedBy,
      provider: 'groq',
      route: 'job:ai.tasks.generate',
      outcome: 'error',
    })
    throw new AutomationError(
      error instanceof Error ? error.message : 'AI task generation failed',
      'transient'
    )
  }
}
