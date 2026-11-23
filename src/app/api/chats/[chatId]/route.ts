import { connectDB } from '@/lib/mongodb/client'
import { Chat } from '@/lib/mongodb/models/Chat'
import { Message } from '@/lib/mongodb/models/Message'
import { User } from '@/lib/mongodb/models/User'
import { getActiveTenantContext, workspaceScopedFilter } from '@/lib/tenancy/context'
import { isMultiTenantEnforced } from '@/lib/tenancy/flags'
import { mergeMongoFilters, tenantErrorResponse } from '@/lib/tenancy/http'
import { NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { paginationSchema, parseWithSchema } from '@/lib/api/validation'

void User

export async function GET(req: Request, { params }: { params: Promise<{ chatId: string }> }) {
  try {
    const ctx = await getActiveTenantContext({ requireWorkspace: isMultiTenantEnforced() })
    const { chatId } = await params

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return NextResponse.json({ error: 'Invalid chat ID format' }, { status: 400 })
    }

    const { searchParams } = new URL(req.url)
    const parsed = parseWithSchema(paginationSchema, {
      limit: searchParams.get('limit') || 50,
      cursor: searchParams.get('cursor') || undefined,
    })
    if (parsed.ok === false) return parsed.response

    await connectDB()
    const chat = await Chat.findOne(
      mergeMongoFilters(workspaceScopedFilter(ctx), {
        _id: chatId,
        participants: ctx.userId,
      })
    ).populate('participants', 'name email image role')

    if (!chat) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const filter: Record<string, unknown> = { chatId }
    if (parsed.data.cursor && mongoose.Types.ObjectId.isValid(parsed.data.cursor)) {
      filter._id = { $gt: new mongoose.Types.ObjectId(parsed.data.cursor) }
    }

    const messages = await Message.find(filter)
      .populate('senderId', 'name email image role')
      .sort({ createdAt: 1, _id: 1 })
      .limit(parsed.data.limit + 1)

    const hasMore = messages.length > parsed.data.limit
    const page = hasMore ? messages.slice(0, parsed.data.limit) : messages
    const nextCursor = hasMore ? String(page[page.length - 1]._id) : null

    return NextResponse.json({
      chat,
      messages: page,
      pagination: {
        limit: parsed.data.limit,
        nextCursor,
        hasMore,
      },
    })
  } catch (error) {
    return tenantErrorResponse(error, 'Internal server error')
  }
}
