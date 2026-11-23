import { connectDB } from '@/lib/mongodb/client'
import { Chat } from '@/lib/mongodb/models/Chat'
import { Message } from '@/lib/mongodb/models/Message'
import { User } from '@/lib/mongodb/models/User'
import { getActiveTenantContext, workspaceScopedFilter } from '@/lib/tenancy/context'
import { isMultiTenantEnforced } from '@/lib/tenancy/flags'
import { mergeMongoFilters, tenantErrorResponse } from '@/lib/tenancy/http'
import { NextResponse } from 'next/server'
import mongoose from 'mongoose'

void User

export async function POST(req: Request, { params }: { params: Promise<{ chatId: string }> }) {
  try {
    const ctx = await getActiveTenantContext({ requireWorkspace: isMultiTenantEnforced() })
    const { chatId } = await params
    const { content } = await req.json()

    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'Message content is required' }, { status: 400 })
    }

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return NextResponse.json({ error: 'Invalid chat ID format' }, { status: 400 })
    }

    await connectDB()

    const chat = await Chat.findOne(
      mergeMongoFilters(workspaceScopedFilter(ctx), {
        _id: chatId,
        participants: ctx.userId,
      })
    )

    if (!chat) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const message = await Message.create({
      chatId,
      senderId: ctx.userId,
      content: content.trim(),
      readBy: [ctx.userId],
    })

    chat.lastMessageAt = message.createdAt
    await chat.save()

    const populatedMessage = await Message.findById(message._id).populate(
      'senderId',
      'name email image role'
    )

    return NextResponse.json(populatedMessage, { status: 201 })
  } catch (error) {
    return tenantErrorResponse(error, 'Internal server error')
  }
}
