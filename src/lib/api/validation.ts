import { z } from 'zod'
import { apiError } from '@/lib/api/response'

export const objectIdSchema = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, 'Invalid id')

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
  page: z.coerce.number().int().min(1).max(10000).optional(),
})

export type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; response: ReturnType<typeof apiError> }

export function parseWithSchema<T>(schema: z.ZodType<T>, data: unknown): ParseResult<T> {
  const result = schema.safeParse(data)
  if (!result.success) {
    const message = result.error.issues.map((i) => i.message).join('; ') || 'Invalid request'
    return { ok: false, response: apiError(message, 400) }
  }
  return { ok: true, data: result.data }
}

export const projectCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    description: z.string().max(5000).optional(),
    status: z.enum(['active', 'paused', 'done']).optional(),
    color: z.string().max(32).optional(),
    dueDate: z.union([z.string(), z.null()]).optional(),
    members: z.array(objectIdSchema).max(100).optional(),
  })
  .strict()

export const taskCreateSchema = z
  .object({
    projectId: objectIdSchema,
    title: z.string().trim().min(1).max(300),
    description: z.string().max(10000).optional(),
    status: z.enum(['todo', 'in_progress', 'review', 'done']).optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    assigneeId: objectIdSchema.optional(),
    dueDate: z.union([z.string(), z.null()]).optional(),
    tags: z.array(z.string().max(50)).max(20).optional(),
  })
  .strict()

export const registerSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    email: z.string().trim().email().max(320),
    password: z.string().min(8).max(200),
  })
  .strict()
