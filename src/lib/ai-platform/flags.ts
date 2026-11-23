export function isAiPlatformEnabled(): boolean {
  return process.env.AI_PLATFORM_ENABLED === 'true'
}

export function isAiAgentsEnabled(): boolean {
  return process.env.AI_AGENTS_ENABLED === 'true'
}

export function isKnowledgeBasesEnabled(): boolean {
  return process.env.KNOWLEDGE_BASES_ENABLED === 'true'
}
