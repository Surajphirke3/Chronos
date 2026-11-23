import { Schema, model, models } from 'mongoose'

const OrganizationRoleSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, trim: true, lowercase: true, maxlength: 80 },
    description: { type: String, default: '', maxlength: 500 },
    permissions: { type: [String], default: [] },
    isSystem: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    version: { type: Number, default: 1, min: 1 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
)

OrganizationRoleSchema.index({ organizationId: 1, slug: 1 }, { unique: true })
OrganizationRoleSchema.index({ organizationId: 1, isActive: 1, name: 1 })

export const OrganizationRole =
  (models.OrganizationRole || model('OrganizationRole', OrganizationRoleSchema)) as any
