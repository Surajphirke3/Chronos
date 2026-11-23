import { connectDB } from '@/lib/mongodb/client'
import { AutomationSchedule } from '@/lib/mongodb/models/AutomationSchedule'
import { enqueueJob } from '@/lib/automation/queue/enqueue'
import { automationLog } from '@/lib/automation/observability'
import { getAutomationConfig } from '@/lib/automation/config'

/**
 * Dispatch due schedules atomically (lock via findOneAndUpdate on nextRunAt).
 * Supports once + interval only (no cron dependency).
 */
export async function runSchedulerTick(now = new Date()): Promise<{ dispatched: number }> {
  const config = getAutomationConfig()
  if (!config.schedulerEnabled && process.env.NODE_ENV !== 'test') {
    // Still allow explicit cron route to call; gate soft in process worker only
  }

  await connectDB()
  let dispatched = 0

  for (let i = 0; i < 20; i++) {
    const schedule = await AutomationSchedule.findOneAndUpdate(
      {
        enabled: true,
        status: 'active',
        nextRunAt: { $lte: now },
      },
      {
        $set: {
          // Tentative lock: push nextRunAt far so concurrent ticks skip
          nextRunAt: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
        },
      },
      { new: false, sort: { nextRunAt: 1 } }
    )

    if (!schedule) break

    try {
      const { job } = await enqueueJob({
        organizationId: String(schedule.organizationId),
        workspaceId: String(schedule.workspaceId),
        initiatedBy: String(schedule.createdBy),
        jobType: schedule.jobType,
        payload: (schedule.jobPayloadTemplate as Record<string, unknown>) || {},
        idempotencyKey: `sched:${String(schedule._id)}:${schedule.nextRunAt.toISOString()}`,
        priority: 0,
      })

      const updates: Record<string, unknown> = {
        lastRunAt: now,
        lastJobId: (job as { _id: unknown })._id,
      }

      if (schedule.scheduleType === 'once') {
        updates.enabled = false
        updates.status = 'paused'
        updates.nextRunAt = schedule.nextRunAt
      } else {
        const interval = Math.max(60_000, schedule.intervalMs || 60_000)
        // Missed schedule recovery: advance from now, not stale nextRunAt
        updates.nextRunAt = new Date(now.getTime() + interval)
      }

      await AutomationSchedule.updateOne({ _id: schedule._id }, { $set: updates })
      dispatched += 1
    } catch (error) {
      // Restore nextRunAt shortly for retry
      await AutomationSchedule.updateOne(
        { _id: schedule._id },
        { $set: { nextRunAt: new Date(now.getTime() + 60_000) } }
      )
      automationLog('error', 'scheduler.dispatch_failed', {
        scheduleId: String(schedule._id),
        error: error instanceof Error ? error.message : 'unknown',
      })
    }
  }

  automationLog('info', 'scheduler.tick', { dispatched })
  return { dispatched }
}
