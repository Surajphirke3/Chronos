import { Schema, model, models } from 'mongoose'

const UserSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String },
    avatarUrl: { type: String },
    role: { type: String, enum: ['admin', 'member'], default: 'member' },
    /** Explicit platform ops role — never granted via org invitation */
    platformRole: { type: String, enum: ['none', 'platform_admin'], default: 'none' },
    title: { type: String },
    isActive: { type: Boolean, default: true },
    activeOrganizationId: { type: Schema.Types.ObjectId, ref: 'Organization' },
    activeWorkspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace' },
  },
  { timestamps: true }
)

export const User = (models.User || model('User', UserSchema)) as any
