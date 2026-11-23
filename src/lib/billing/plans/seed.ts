import type { EntitlementMap, PlanSlug } from '../types'

function entitlements(overrides: Partial<EntitlementMap> = {}): EntitlementMap {
  const base: EntitlementMap = {
    workspaces: { limit: 1, unit: 'count', period: 'none' },
    teamMembers: { limit: 5, unit: 'count', period: 'none' },
    'projects.active': { limit: 3, unit: 'count', period: 'none' },
    'ai.requests': { limit: 100, unit: 'count', period: 'billing_period' },
    'ai.tokens': { limit: 500_000, unit: 'tokens', period: 'billing_period' },
    'automation.executions': { limit: 50, unit: 'count', period: 'billing_period' },
    'workflow.executions': { limit: 50, unit: 'count', period: 'billing_period' },
    workflows: { limit: 3, unit: 'count', period: 'none' },
    schedules: { limit: 2, unit: 'count', period: 'none' },
    'storage.bytes': { limit: 1_073_741_824, unit: 'bytes', period: 'none' },
    integrations: { limit: 0, unit: 'count', period: 'none' },
    'api.access': { limit: 0, unit: 'boolean', period: 'none' },
    advancedReporting: { limit: 0, unit: 'boolean', period: 'none' },
  }
  return { ...base, ...overrides }
}

function planLimits(overrides: Partial<EntitlementMap> = {}): {
  entitlements: EntitlementMap
  limits: EntitlementMap
} {
  const map = entitlements(overrides)
  return { entitlements: map, limits: { ...map } }
}

export interface PlanSeed {
  name: string
  slug: PlanSlug
  description: string
  currency: 'INR'
  /** Placeholder prices in paise — not final commercial pricing. */
  priceMonthly: number
  priceYearly: number
  billingIntervalOptions: Array<'month' | 'year'>
  trialDays: number
  features: string[]
  entitlements: EntitlementMap
  limits: EntitlementMap
  isPublic: boolean
  isActive: boolean
  displayOrder: number
  providerPriceReferences: Record<string, unknown>
}

/**
 * Configurable placeholder catalog. Do not treat amounts as final pricing.
 */
export const PLAN_SEEDS: PlanSeed[] = [
  {
    name: 'Free',
    slug: 'free',
    description: 'Get started with core Chronos features. No payment method required.',
    currency: 'INR',
    priceMonthly: 0,
    priceYearly: 0,
    billingIntervalOptions: [],
    trialDays: 0,
    features: ['core_projects', 'basic_ai', 'basic_automation'],
    ...planLimits(),
    isPublic: true,
    isActive: true,
    displayOrder: 10,
    providerPriceReferences: { none: true },
  },
  {
    name: 'Starter',
    slug: 'starter',
    description: 'For small teams adopting Chronos.',
    currency: 'INR',
    priceMonthly: 99_900,
    priceYearly: 999_000,
    billingIntervalOptions: ['month', 'year'],
    trialDays: 14,
    features: ['core_projects', 'basic_ai', 'basic_automation', 'email_support'],
    ...planLimits({
      workspaces: { limit: 3, unit: 'count', period: 'none' },
      teamMembers: { limit: 15, unit: 'count', period: 'none' },
      'projects.active': { limit: 20, unit: 'count', period: 'none' },
      'ai.requests': { limit: 1_000, unit: 'count', period: 'billing_period' },
      'ai.tokens': { limit: 5_000_000, unit: 'tokens', period: 'billing_period' },
      'automation.executions': { limit: 500, unit: 'count', period: 'billing_period' },
      'workflow.executions': { limit: 500, unit: 'count', period: 'billing_period' },
      workflows: { limit: 20, unit: 'count', period: 'none' },
      schedules: { limit: 10, unit: 'count', period: 'none' },
      'storage.bytes': { limit: 10_737_418_240, unit: 'bytes', period: 'none' },
      integrations: { limit: 3, unit: 'count', period: 'none' },
    }),
    isPublic: true,
    isActive: true,
    displayOrder: 20,
    providerPriceReferences: {
      mock_razorpay: { planIdMonthly: 'mock_plan_starter_m', planIdYearly: 'mock_plan_starter_y' },
    },
  },
  {
    name: 'Pro',
    slug: 'pro',
    description: 'For growing organizations that need higher automation and AI limits.',
    currency: 'INR',
    priceMonthly: 249_900,
    priceYearly: 2_499_000,
    billingIntervalOptions: ['month', 'year'],
    trialDays: 14,
    features: ['core_projects', 'advanced_ai', 'automation', 'api_access', 'priority_support'],
    ...planLimits({
      workspaces: { limit: 10, unit: 'count', period: 'none' },
      teamMembers: { limit: 50, unit: 'count', period: 'none' },
      'projects.active': { limit: -1, unit: 'count', period: 'none' },
      'ai.requests': { limit: 5_000, unit: 'count', period: 'billing_period' },
      'ai.tokens': { limit: 25_000_000, unit: 'tokens', period: 'billing_period' },
      'automation.executions': { limit: 5_000, unit: 'count', period: 'billing_period' },
      'workflow.executions': { limit: 5_000, unit: 'count', period: 'billing_period' },
      workflows: { limit: 100, unit: 'count', period: 'none' },
      schedules: { limit: 50, unit: 'count', period: 'none' },
      'storage.bytes': { limit: 53_687_091_200, unit: 'bytes', period: 'none' },
      integrations: { limit: 10, unit: 'count', period: 'none' },
      'api.access': { limit: 1, unit: 'boolean', period: 'none' },
      advancedReporting: { limit: 1, unit: 'boolean', period: 'none' },
    }),
    isPublic: true,
    isActive: true,
    displayOrder: 30,
    providerPriceReferences: {
      mock_razorpay: { planIdMonthly: 'mock_plan_pro_m', planIdYearly: 'mock_plan_pro_y' },
    },
  },
  {
    name: 'Business',
    slug: 'business',
    description: 'Higher limits and longer audit retention for larger teams.',
    currency: 'INR',
    priceMonthly: 799_900,
    priceYearly: 7_999_000,
    billingIntervalOptions: ['month', 'year'],
    trialDays: 14,
    features: [
      'core_projects',
      'advanced_ai',
      'automation',
      'api_access',
      'advanced_reporting',
      'audit_history',
      'priority_support',
    ],
    ...planLimits({
      workspaces: { limit: 50, unit: 'count', period: 'none' },
      teamMembers: { limit: 200, unit: 'count', period: 'none' },
      'projects.active': { limit: -1, unit: 'count', period: 'none' },
      'ai.requests': { limit: 25_000, unit: 'count', period: 'billing_period' },
      'ai.tokens': { limit: 100_000_000, unit: 'tokens', period: 'billing_period' },
      'automation.executions': { limit: 25_000, unit: 'count', period: 'billing_period' },
      'workflow.executions': { limit: 25_000, unit: 'count', period: 'billing_period' },
      workflows: { limit: -1, unit: 'count', period: 'none' },
      schedules: { limit: 200, unit: 'count', period: 'none' },
      'storage.bytes': { limit: 214_748_364_800, unit: 'bytes', period: 'none' },
      integrations: { limit: 50, unit: 'count', period: 'none' },
      'api.access': { limit: 1, unit: 'boolean', period: 'none' },
      advancedReporting: { limit: 1, unit: 'boolean', period: 'none' },
    }),
    isPublic: true,
    isActive: true,
    displayOrder: 40,
    providerPriceReferences: {
      mock_razorpay: {
        planIdMonthly: 'mock_plan_business_m',
        planIdYearly: 'mock_plan_business_y',
      },
      manual: true,
    },
  },
  {
    name: 'Enterprise',
    slug: 'enterprise',
    description: 'Custom limits and manual invoicing. Contact sales.',
    currency: 'INR',
    priceMonthly: 0,
    priceYearly: 0,
    billingIntervalOptions: ['month', 'year'],
    trialDays: 0,
    features: [
      'core_projects',
      'advanced_ai',
      'automation',
      'api_access',
      'advanced_reporting',
      'audit_history',
      'sso_ready',
      'dedicated_support',
      'custom_limits',
    ],
    ...planLimits({
      workspaces: { limit: -1, unit: 'count', period: 'none' },
      teamMembers: { limit: -1, unit: 'count', period: 'none' },
      'projects.active': { limit: -1, unit: 'count', period: 'none' },
      'ai.requests': { limit: -1, unit: 'count', period: 'billing_period' },
      'ai.tokens': { limit: -1, unit: 'tokens', period: 'billing_period' },
      'automation.executions': { limit: -1, unit: 'count', period: 'billing_period' },
      'workflow.executions': { limit: -1, unit: 'count', period: 'billing_period' },
      workflows: { limit: -1, unit: 'count', period: 'none' },
      schedules: { limit: -1, unit: 'count', period: 'none' },
      'storage.bytes': { limit: -1, unit: 'bytes', period: 'none' },
      integrations: { limit: -1, unit: 'count', period: 'none' },
      'api.access': { limit: 1, unit: 'boolean', period: 'none' },
      advancedReporting: { limit: 1, unit: 'boolean', period: 'none' },
    }),
    isPublic: false,
    isActive: true,
    displayOrder: 50,
    providerPriceReferences: { manual: true },
  },
]

export function getPlanSeed(slug: PlanSlug): PlanSeed {
  const seed = PLAN_SEEDS.find((p) => p.slug === slug)
  if (!seed) throw new Error(`Unknown plan slug: ${slug}`)
  return seed
}
