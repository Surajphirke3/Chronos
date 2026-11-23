export type IntegrationProviderId =
  | 'http_generic'
  | 'slack'
  | 'github'
  | 'google_workspace'
  | 'notion'
  | 'discord'
  | 'microsoft_teams'

export type IntegrationProviderDefinition = {
  id: IntegrationProviderId
  name: string
  description: string
  authType: 'oauth2' | 'api_key' | 'webhook_only' | 'none'
  /** Live connection requires credentials; adapters may still be tested offline. */
  liveAvailable: boolean
  scopes?: string[]
  docsPath?: string
}

/** Internal integration catalog — only mark liveAvailable when credentials exist. */
export const INTEGRATION_PROVIDERS: IntegrationProviderDefinition[] = [
  {
    id: 'http_generic',
    name: 'Generic HTTP',
    description: 'Outbound signed HTTP actions and inbound webhook receivers.',
    authType: 'api_key',
    liveAvailable: true,
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Slack workspace notifications and event triggers.',
    authType: 'oauth2',
    liveAvailable: false,
    scopes: ['chat:write', 'channels:read'],
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'Repository events and workflow triggers.',
    authType: 'oauth2',
    liveAvailable: false,
    scopes: ['repo', 'read:org'],
  },
  {
    id: 'google_workspace',
    name: 'Google Workspace',
    description: 'Google account connections (extends existing OAuth patterns).',
    authType: 'oauth2',
    liveAvailable: false,
  },
  {
    id: 'notion',
    name: 'Notion',
    description: 'Notion workspace sync.',
    authType: 'oauth2',
    liveAvailable: false,
  },
  {
    id: 'discord',
    name: 'Discord',
    description: 'Discord server notifications.',
    authType: 'oauth2',
    liveAvailable: false,
  },
  {
    id: 'microsoft_teams',
    name: 'Microsoft Teams',
    description: 'Teams channel notifications.',
    authType: 'oauth2',
    liveAvailable: false,
  },
]

export function getIntegrationProvider(id: string): IntegrationProviderDefinition | undefined {
  return INTEGRATION_PROVIDERS.find((p) => p.id === id)
}

export function isIntegrationsEnabled(): boolean {
  return process.env.INTEGRATIONS_ENABLED === 'true'
}

export function isWebhooksEnabled(): boolean {
  return process.env.WEBHOOKS_ENABLED === 'true'
}

export function isPublicApiEnabled(): boolean {
  return process.env.PUBLIC_API_ENABLED === 'true'
}
