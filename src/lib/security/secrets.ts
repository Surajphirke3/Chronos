import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'crypto'

/** Versioned envelope: enc:v1:<iv>:<ciphertext>:<tag> (base64url) */
const ENVELOPE_RE = /^enc:v1:([A-Za-z0-9_-]+):([A-Za-z0-9_-]+):([A-Za-z0-9_-]+)$/

export class SecretEncryptionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SecretEncryptionError'
  }
}

function getKey(): Buffer {
  const raw = process.env.CHRONOS_ENCRYPTION_KEY
  if (!raw || !raw.trim()) {
    throw new SecretEncryptionError(
      'CHRONOS_ENCRYPTION_KEY is not configured. Refusing to process secrets.'
    )
  }

  let key: Buffer
  try {
    key = Buffer.from(raw.trim(), 'base64')
  } catch {
    throw new SecretEncryptionError('CHRONOS_ENCRYPTION_KEY must be base64-encoded')
  }

  if (key.length !== 32) {
    throw new SecretEncryptionError(
      'CHRONOS_ENCRYPTION_KEY must decode to exactly 32 bytes (AES-256)'
    )
  }

  return key
}

export function isEncryptedSecret(value: unknown): boolean {
  return typeof value === 'string' && ENVELOPE_RE.test(value)
}

export function encryptSecret(plaintext: string): string {
  if (typeof plaintext !== 'string') {
    throw new SecretEncryptionError('Secret plaintext must be a string')
  }
  if (isEncryptedSecret(plaintext)) {
    return plaintext
  }

  const key = getKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return [
    'enc:v1',
    iv.toString('base64url'),
    encrypted.toString('base64url'),
    tag.toString('base64url'),
  ].join(':')
}

export function decryptSecret(value: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    return ''
  }

  // Legacy plaintext support for pre-migration reads only
  if (!value.startsWith('enc:v1:')) {
    return value
  }

  const match = ENVELOPE_RE.exec(value)
  if (!match) {
    throw new SecretEncryptionError('Malformed encrypted secret envelope')
  }

  const key = getKey()
  const ivBuf = Buffer.from(match[1], 'base64url')
  const ctBuf = Buffer.from(match[2], 'base64url')
  const tagBuf = Buffer.from(match[3], 'base64url')

  try {
    const decipher = createDecipheriv('aes-256-gcm', key, ivBuf)
    decipher.setAuthTag(tagBuf)
    const decrypted = Buffer.concat([decipher.update(ctBuf), decipher.final()])
    return decrypted.toString('utf8')
  } catch {
    throw new SecretEncryptionError('Failed to decrypt secret (wrong key or tampered data)')
  }
}

/** Encrypt only if non-empty; empty string stays empty. */
export function encryptSecretIfPresent(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string') {
    throw new SecretEncryptionError('Secret must be a string')
  }
  if (!value) return ''
  return encryptSecret(value)
}

export function assertEncryptionConfigured(): void {
  getKey()
}

/** Timing-safe compare for cron secrets etc. */
export function safeEqualString(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

export const WORKFLOW_SECRET_FIELDS = ['smtpPass', 'aiApiKey'] as const

export function encryptWorkflowConfigSecrets(
  config: Record<string, unknown> | null | undefined
): Record<string, unknown> | undefined {
  if (!config || typeof config !== 'object') return config ?? undefined
  const next = { ...config }
  for (const field of WORKFLOW_SECRET_FIELDS) {
    if (typeof next[field] === 'string' && next[field]) {
      next[field] = encryptSecret(next[field] as string)
    }
  }
  return next
}

export function decryptWorkflowConfigSecrets<T extends Record<string, unknown>>(
  config: T | null | undefined
): T | undefined {
  if (!config || typeof config !== 'object') return config ?? undefined
  const next = { ...config } as Record<string, unknown>
  for (const field of WORKFLOW_SECRET_FIELDS) {
    if (typeof next[field] === 'string' && next[field]) {
      next[field] = decryptSecret(next[field] as string)
    }
  }
  return next as T
}

export function redactWorkflowConfigSecrets<T extends Record<string, unknown>>(
  config: T | null | undefined
): T | undefined {
  if (!config || typeof config !== 'object') return config ?? undefined
  const next = { ...config } as Record<string, unknown>
  for (const field of WORKFLOW_SECRET_FIELDS) {
    if (typeof next[field] === 'string' && (next[field] as string).length > 0) {
      next[field] = ''
      next[`${field}Set`] = true
    } else if (field in next) {
      next[`${field}Set`] = false
    }
  }
  return next as T
}
