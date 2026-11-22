import { Schema, model, models } from 'mongoose'

const AutomationScheduleSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true },
    enabled: { type: Boolean, default: true },
    scheduleType: { type: String, enum: ['once', 'interval'], default: 'once' },
    timezone: { type: String, default: 'UTC' },
    runAt: { type: Date },
    intervalMs: { type: Number },
    jobType: { type: String, required: true },
    jobPayloadTemplate: { type: Schema.Types.Mixed, default: {} },
    nextRunAt: { type: Date, required: true },
    lastRunAt: { type: Date },
    lastJobId: { type: Schema.Types.ObjectId, ref: 'Job' },
    status: { type: String, enum: ['active', 'paused', 'archived'], default: 'active' },
  },
  { timestamps: true }
)

AutomationScheduleSchema.index({ enabled: 1, nextRunAt: 1, status: 1 })
AutomationScheduleSchema.index({ workspaceId: 1, status: 1 })

export const AutomationSchedule =
  (models.AutomationSchedule || model('AutomationSchedule', AutomationScheduleSchema)) as any
