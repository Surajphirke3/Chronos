import { Schema, model, models } from 'mongoose'

const OrganizationSecurityPolicySchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    version: { type: Number, default: 1 },
    allowedInviteEmailDomains: { type: [String], default: [] },
    allowGuestAccess: { type: Boolean, default: true },
    whoCanInvite: {
      type: String,
      enum: ['owner', 'admin', 'members_with_permission'],
      default: 'admin',
    },
    allowApiKeyCreation: { type: Boolean, default: false },
    maxApiKeyLifetimeDays: { type: Number, default: 365, min: 1, max: 730 },
    allowDataExport: { type: Boolean, default: false },
    restrictWorkspaceCreationToAdmins: { type: Boolean, default: true },
    /** MFA is not supported by the auth stack — always unsupported. */
    mfa: {
      status: { type: String, enum: ['unsupported'], default: 'unsupported' },
    },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
)

OrganizationSecurityPolicySchema.index({ organizationId: 1 }, { unique: true })

export const OrganizationSecurityPolicy =
  (models.OrganizationSecurityPolicy ||
    model('OrganizationSecurityPolicy', OrganizationSecurityPolicySchema)) as any
