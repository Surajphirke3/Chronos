import { createHash, randomBytes, timingSafeEqual } from 'crypto'

const PEPPER = () => process.env.API_KEY_PEPPER || process.env.NEXTAUTH_SECRET || 'dev-only-pepper'

export function generateApiKeySecret(): { raw: string; prefix: string; hash: string } {
  const rawSecret = randomBytes(32).toString('base64url')
  const raw = `chronos_${rawSecret}`
  const prefix = raw.slice(0, 16)
  return { raw, prefix, hash: hashApiKeySecret(raw) }
}

export function hashApiKeySecret(raw: string): string {
  return createHash('sha256').update(`${PEPPER()}:${raw}`).digest('hex')
}

export function verifyApiKeySecret(raw: string, hash: string): boolean {
  const computed = Buffer.from(hashApiKeySecret(raw), 'hex')
  const expected = Buffer.from(hash, 'hex')
  if (computed.length !== expected.length) return false
  return timingSafeEqual(computed, expected)
}
