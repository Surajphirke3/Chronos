/**
 * Multi-tenancy backfill for Chronos.
 *
 * Usage:
 *   npx tsx scripts/migrate-tenancy.ts           # dry-run (default)
 *   npx tsx scripts/migrate-tenancy.ts --apply   # write changes
 *
 * Never run automatically at app startup.
 * Take a MongoDB backup before --apply.
 */

import dotenv from 'dotenv'
import mongoose from 'mongoose'
import {
  DEFAULT_ORG_MIGRATION_KEY,
  DEFAULT_WORKSPACE_MIGRATION_KEY,
} from '../src/lib/tenancy/flags'

dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env', override: false })

const APPLY = process.argv.includes('--apply')

type Summary = {
  mode: 'dry-run' | 'apply'
  organizationCreated: boolean
  workspaceCreated: boolean
  usersProcessed: number
  membershipsUpserted: number
  workspaceMembershipsUpserted: number
  projectsBackfilled: number
  docsBackfilled: number
  leadsBackfilled: number
  workflowsBackfilled: number
  executionsBackfilled: number
  chatsBackfilled: number
  activityBackfilled: number
  ownerUserId: string | null
}

async function countMissingWorkspace(db: mongoose.mongo.Db, name: string) {
  return db.collection(name).countDocuments({
    $or: [{ workspaceId: { $exists: false } }, { workspaceId: null }],
  })
}

async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    console.error('MONGODB_URI is required')
    process.exit(1)
  }

  await mongoose.connect(uri)
  const db = mongoose.connection.db
  if (!db) throw new Error('No database connection')

  const summary: Summary = {
    mode: APPLY ? 'apply' : 'dry-run',
    organizationCreated: false,
    workspaceCreated: false,
    usersProcessed: 0,
    membershipsUpserted: 0,
    workspaceMembershipsUpserted: 0,
    projectsBackfilled: 0,
    docsBackfilled: 0,
    leadsBackfilled: 0,
    workflowsBackfilled: 0,
    executionsBackfilled: 0,
    chatsBackfilled: 0,
    activityBackfilled: 0,
    ownerUserId: null,
  }

  const orgs = db.collection('organizations')
  const workspaces = db.collection('workspaces')
  const users = db.collection('users')
  const memberships = db.collection('memberships')
  const workspaceMemberships = db.collection('workspacememberships')

  let org = await orgs.findOne({ migrationKey: DEFAULT_ORG_MIGRATION_KEY })
  if (!org) {
    summary.organizationCreated = true
    if (APPLY) {
      const inserted = await orgs.insertOne({
        name: 'Default Organization',
        slug: 'default',
        description: 'Migrated Chronos deployment tenant',
        logoUrl: '',
        status: 'active',
        createdBy: null,
        settings: {},
        migrationKey: DEFAULT_ORG_MIGRATION_KEY,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      org = await orgs.findOne({ _id: inserted.insertedId })
    }
  }

  let workspace = org
    ? await workspaces.findOne({ migrationKey: DEFAULT_WORKSPACE_MIGRATION_KEY })
    : null

  if (org && !workspace) {
    summary.workspaceCreated = true
    if (APPLY) {
      const inserted = await workspaces.insertOne({
        organizationId: org._id,
        name: 'General',
        slug: 'general',
        description: 'Default migrated workspace',
        type: 'general',
        createdBy: null,
        settings: {},
        isDefault: true,
        status: 'active',
        migrationKey: DEFAULT_WORKSPACE_MIGRATION_KEY,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      workspace = await workspaces.findOne({ _id: inserted.insertedId })
    }
  }

  if (!APPLY) {
    summary.usersProcessed = await users.countDocuments({})
    summary.membershipsUpserted = summary.usersProcessed
    summary.workspaceMembershipsUpserted = summary.usersProcessed
    summary.projectsBackfilled = await countMissingWorkspace(db, 'projects')
    summary.docsBackfilled = await countMissingWorkspace(db, 'docs')
    summary.leadsBackfilled = await countMissingWorkspace(db, 'leads')
    summary.workflowsBackfilled = await countMissingWorkspace(db, 'workflows')
    summary.executionsBackfilled = await countMissingWorkspace(db, 'workflowexecutions')
    summary.chatsBackfilled = await countMissingWorkspace(db, 'chats')
    summary.activityBackfilled = await countMissingWorkspace(db, 'activitylogs')

    const ownerCandidate =
      (await users.find({ role: 'admin' }).sort({ createdAt: 1 }).limit(1).next()) ||
      (await users.find({}).sort({ createdAt: 1 }).limit(1).next())
    summary.ownerUserId = ownerCandidate ? String(ownerCandidate._id) : null

    console.log(JSON.stringify(summary, null, 2))
    console.log('\nDry-run only. Re-run with --apply to write changes.')
    await mongoose.disconnect()
    return
  }

  if (!org || !workspace) {
    console.error('Failed to resolve default organization/workspace')
    process.exit(1)
  }

  const orgId = org._id
  const workspaceId = workspace._id

  const ownerCandidate =
    (await users.find({ role: 'admin' }).sort({ createdAt: 1 }).limit(1).next()) ||
    (await users.find({}).sort({ createdAt: 1 }).limit(1).next())
  const ownerId = ownerCandidate?._id || null
  summary.ownerUserId = ownerId ? String(ownerId) : null

  const userCursor = users.find({})
  while (await userCursor.hasNext()) {
    const user = await userCursor.next()
    if (!user) continue
    summary.usersProcessed += 1

    const isOwner = ownerId && String(user._id) === String(ownerId)
    const orgRole = isOwner ? 'owner' : user.role === 'admin' ? 'admin' : 'member'
    const wsRole = isOwner ? 'owner' : user.role === 'admin' ? 'admin' : 'member'

    await memberships.updateOne(
      { organizationId: orgId, userId: user._id },
      {
        $set: {
          status: 'active',
          role: orgRole,
          joinedAt: user.createdAt || new Date(),
        },
        $setOnInsert: {
          organizationId: orgId,
          userId: user._id,
        },
      },
      { upsert: true }
    )
    summary.membershipsUpserted += 1

    await workspaceMemberships.updateOne(
      { workspaceId, userId: user._id },
      {
        $set: {
          organizationId: orgId,
          status: 'active',
          role: wsRole,
          joinedAt: user.createdAt || new Date(),
        },
        $setOnInsert: {
          workspaceId,
          userId: user._id,
        },
      },
      { upsert: true }
    )
    summary.workspaceMembershipsUpserted += 1

    await users.updateOne(
      { _id: user._id },
      {
        $set: {
          activeOrganizationId: orgId,
          activeWorkspaceId: workspaceId,
          // Legacy User.role=admin does NOT become platform_admin
          platformRole: user.platformRole || 'none',
        },
      }
    )
  }

  if (ownerId) {
    await orgs.updateOne({ _id: orgId }, { $set: { createdBy: ownerId } })
    await workspaces.updateOne({ _id: workspaceId }, { $set: { createdBy: ownerId } })
  }

  async function backfill(collectionName: string, key: keyof Summary) {
    const result = await db!.collection(collectionName).updateMany(
      { $or: [{ workspaceId: { $exists: false } }, { workspaceId: null }] },
      { $set: { organizationId: orgId, workspaceId } }
    )
    ;(summary as Record<string, unknown>)[key] = result.modifiedCount
  }

  await backfill('projects', 'projectsBackfilled')
  await backfill('docs', 'docsBackfilled')
  await backfill('leads', 'leadsBackfilled')
  await backfill('workflows', 'workflowsBackfilled')
  await backfill('workflowexecutions', 'executionsBackfilled')
  await backfill('chats', 'chatsBackfilled')
  await backfill('activitylogs', 'activityBackfilled')

  console.log(JSON.stringify(summary, null, 2))
  await mongoose.disconnect()
}

main().catch((err) => {
  console.error('Tenancy migration failed:', err instanceof Error ? err.message : 'unknown')
  process.exit(1)
})
