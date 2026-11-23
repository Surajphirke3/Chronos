/**
 * Encrypt plaintext secrets in UserSettings and Workflow.config.
 *
 * Usage:
 *   npx tsx scripts/migrate-secrets.ts              # dry-run (default)
 *   npx tsx scripts/migrate-secrets.ts --apply      # write changes
 *
 * Requires MONGODB_URI and CHRONOS_ENCRYPTION_KEY in .env.local / env.
 * Never prints secret values.
 */

import dotenv from 'dotenv'
import mongoose from 'mongoose'
import {
  encryptSecret,
  isEncryptedSecret,
  WORKFLOW_SECRET_FIELDS,
} from '../src/lib/security/secrets'

dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env', override: false })

const APPLY = process.argv.includes('--apply')

async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    console.error('MONGODB_URI is required')
    process.exit(1)
  }
  if (!process.env.CHRONOS_ENCRYPTION_KEY) {
    console.error('CHRONOS_ENCRYPTION_KEY is required')
    process.exit(1)
  }

  await mongoose.connect(uri)
  const db = mongoose.connection.db
  if (!db) throw new Error('No database')

  const summary = {
    mode: APPLY ? 'apply' : 'dry-run',
    userSettingsScanned: 0,
    userSettingsUpdated: 0,
    userSettingsSkipped: 0,
    workflowsScanned: 0,
    workflowsUpdated: 0,
    workflowsSkipped: 0,
    failures: 0,
  }

  const settingsCol = db.collection('usersettings')
  const settingsCursor = settingsCol.find({})
  while (await settingsCursor.hasNext()) {
    const doc = await settingsCursor.next()
    if (!doc) continue
    summary.userSettingsScanned += 1

    const $set: Record<string, string> = {}
    for (const field of ['emailAppPassword', 'aiApiKey'] as const) {
      const value = doc[field]
      if (typeof value !== 'string' || !value) continue
      if (isEncryptedSecret(value)) continue
      try {
        $set[field] = encryptSecret(value)
      } catch {
        summary.failures += 1
      }
    }

    if (Object.keys($set).length === 0) {
      summary.userSettingsSkipped += 1
      continue
    }

    if (APPLY) {
      await settingsCol.updateOne({ _id: doc._id }, { $set })
    }
    summary.userSettingsUpdated += 1
  }

  const workflowsCol = db.collection('workflows')
  const workflowsCursor = workflowsCol.find({})
  while (await workflowsCursor.hasNext()) {
    const doc = await workflowsCursor.next()
    if (!doc) continue
    summary.workflowsScanned += 1

    const config = (doc.config || {}) as Record<string, unknown>
    const nextConfig = { ...config }
    let changed = false

    for (const field of WORKFLOW_SECRET_FIELDS) {
      const value = nextConfig[field]
      if (typeof value !== 'string' || !value) continue
      if (isEncryptedSecret(value)) continue
      try {
        nextConfig[field] = encryptSecret(value)
        changed = true
      } catch {
        summary.failures += 1
      }
    }

    if (!changed) {
      summary.workflowsSkipped += 1
      continue
    }

    if (APPLY) {
      await workflowsCol.updateOne({ _id: doc._id }, { $set: { config: nextConfig } })
    }
    summary.workflowsUpdated += 1
  }

  console.log(JSON.stringify(summary, null, 2))
  await mongoose.disconnect()
  process.exit(summary.failures > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('Migration failed:', err instanceof Error ? err.message : 'unknown error')
  process.exit(1)
})
