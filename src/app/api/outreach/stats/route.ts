import { connectDB } from '@/lib/mongodb/client'
import { Lead } from '@/lib/mongodb/models/Lead'
import { WorkflowExecution } from '@/lib/mongodb/models/WorkflowExecution'
import { NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { getActiveTenantContext, workspaceScopedFilter } from '@/lib/tenancy/context'
import { isMultiTenantEnforced } from '@/lib/tenancy/flags'
import { mergeMongoFilters, tenantErrorResponse } from '@/lib/tenancy/http'

export async function GET() {
  try {
    const ctx = await getActiveTenantContext({ requireWorkspace: isMultiTenantEnforced() })
    await connectDB()

    let ownerObjId: mongoose.Types.ObjectId | string
    try {
      ownerObjId = new mongoose.Types.ObjectId(ctx.userId)
    } catch {
      ownerObjId = ctx.userId
    }

    const scope = workspaceScopedFilter(ctx)
    const legacyOwner = ctx.workspaceId ? {} : { ownerId: ownerObjId }
    const match = mergeMongoFilters(scope, legacyOwner)

    const leadCounts = await Lead.aggregate([
      { $match: match },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ])

    const leadStats: Record<string, number> = {}
    let totalLeads = 0
    for (const item of leadCounts) {
      leadStats[item._id] = item.count
      totalLeads += item.count
    }

    const execCounts = await WorkflowExecution.aggregate([
      { $match: match },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ])

    const execStats: Record<string, number> = {}
    for (const item of execCounts) {
      execStats[item._id] = item.count
    }

    const executions = await WorkflowExecution.find(match)
      .sort({ updatedAt: -1 })
      .limit(100)
      .populate('leadId', 'firstName lastName email company status')
      .populate('workflowId', 'name')
      .lean()

    return NextResponse.json({
      total: totalLeads,
      leads: {
        new: leadStats['new'] || 0,
        contacted: leadStats['contacted'] || 0,
        in_sequence: leadStats['in_sequence'] || 0,
        replied: leadStats['replied'] || 0,
        converted: leadStats['converted'] || 0,
        opted_out: leadStats['opted_out'] || 0,
        bounced: leadStats['bounced'] || 0,
      },
      executions: {
        pending: execStats['pending'] || 0,
        running: execStats['running'] || 0,
        paused: execStats['paused'] || 0,
        completed: execStats['completed'] || 0,
        failed: execStats['failed'] || 0,
        opted_out: execStats['opted_out'] || 0,
      },
      recentExecutions: executions,
    })
  } catch (error) {
    return tenantErrorResponse(error, 'Failed to fetch stats')
  }
}
