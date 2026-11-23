import { Schema, model, models } from 'mongoose'

const OrganizationSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true },
    description: { type: String, default: '' },
    logoUrl: { type: String, default: '' },
    status: {
      type: String,
      enum: ['active', 'archived'],
      default: 'active',
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    settings: { type: Schema.Types.Mixed, default: {} },
    /** Stable migration marker for the deployment default org */
    migrationKey: { type: String, default: null },
  },
  { timestamps: true }
)

OrganizationSchema.index({ slug: 1 }, { unique: true })
OrganizationSchema.index({ migrationKey: 1 }, { unique: true, sparse: true })
OrganizationSchema.index({ status: 1 })

export const Organization =
  (models.Organization || model('Organization', OrganizationSchema)) as any
