import { createHmac, randomBytes, timingSafeEqual } from 'crypto'

export function generateWebhookSecret(): { raw: string; prefix: string; hash: string } {
  const raw = `whsec_${randomBytes(24).toString('base64url')}`
  return { raw, prefix: raw.slice(0, 12), hash: hashWebhookSecret(raw) }
}

export function hashWebhookSecret(raw: string): string {
  return createHmac('sha256', process.env.NEXTAUTH_SECRET || 'dev')
    .update(raw)
    .digest('hex')
}

/** Chronos outbound signature: t=timestamp,v1=hex */
export function signWebhookPayload(secret: string, body: string, timestamp = Date.now()): string {
  const payload = `${Math.floor(timestamp / 1000)}.${body}`
  const sig = createHmac('sha256', secret).update(payload).digest('hex')
  return `t=${Math.floor(timestamp / 1000)},v1=${sig}`
}

export function verifyWebhookSignature(
  secret: string,
  body: string,
  header: string,
  maxSkewSeconds = 300
): boolean {
  const parts = Object.fromEntries(
    header.split(',').map((p) => {
      const [k, v] = p.split('=')
      return [k, v]
    })
  )
  const t = Number(parts.t)
  const v1 = parts.v1
  if (!t || !v1) return false
  if (Math.abs(Date.now() / 1000 - t) > maxSkewSeconds) return false
  const expected = signWebhookPayload(secret, body, t * 1000)
  const expectedV1 = expected.split('v1=')[1]
  try {
    return timingSafeEqual(Buffer.from(v1), Buffer.from(expectedV1))
  } catch {
    return false
  }
}
