import { connectDB } from '@/lib/mongodb/client'
import { Chat } from '@/lib/mongodb/models/Chat'
import { Message } from '@/lib/mongodb/models/Message'
import { User } from '@/lib/mongodb/models/User'
import { WorkspaceMembership } from '@/lib/mongodb/models/WorkspaceMembership'
import { getActiveTenantContext, workspaceScopedFilter } from '@/lib/tenancy/context'
import { isMultiTenantEnforced } from '@/lib/tenancy/flags'
import { mergeMongoFilters, tenantErrorResponse } from '@/lib/tenancy/http'
import { NextResponse } from 'next/server'
import mongoose from 'mongoose'

void User
void Message

export async function GET() {
  try {
    const ctx = await getActiveTenantContext({ requireWorkspace: isMultiTenantEnforced() })
    await connectDB()
    const userObjectId = new mongoose.Types.ObjectId(ctx.userId)

    const match = mergeMongoFilters(workspaceScopedFilter(ctx), {
      participants: userObjectId,
    })

    const chatsWithLatestMessage = await Chat.aggregate([
      { $match: match },
      { $sort: { lastMessageAt: -1 } },
      {
        $lookup: {
          from: 'messages',
          let: { chatId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$chatId', '$$chatId'] } } },
            { $sort: { createdAt: -1 } },
            { $limit: 1 },
          ],
          as: 'latestMessages',
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'participants',
          foreignField: '_id',
          as: 'participantDocs',
        },
      },
      {
        $addFields: {
          latestMessage: { $arrayElemAt: ['$latestMessages', 0] },
          participants: {
            $map: {
              input: '$participantDocs',
              as: 'p',
              in: {
                _id: '$$p._id',
                name: '$$p.name',
                email: '$$p.email',
                role: '$$p.role',
                avatarUrl: '$$p.avatarUrl',
              },
            },
          },
        },
      },
      { $project: { latestMessages: 0, participantDocs: 0 } },
    ])

    return NextResponse.json(chatsWithLatestMessage)
  } catch (error) {
    return tenantErrorResponse(error, 'Internal server error')
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await getActiveTenantContext({ requireWorkspace: isMultiTenantEnforced() })
    await connectDB()
    const { isGroup, name, participantIds } = await req.json()

    if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
      return NextResponse.json({ error: 'Participants are required' }, { status: 400 })
    }

    // Participants must be workspace members when a workspace is active
    if (ctx.workspaceId) {
      const allowed = await WorkspaceMembership.find({
        workspaceId: ctx.workspaceId,
        userId: { $in: participantIds },
        status: 'active',
      }).select('userId')
      const allowedIds = new Set(allowed.map((m: { userId: { toString: () => string } }) => String(m.userId)))
      if (participantIds.some((id: string) => !allowedIds.has(String(id)))) {
        return NextResponse.json({ error: 'Participants must be workspace members' }, { status: 403 })
      }
    }

    const allParticipantIds = [...new Set([...participantIds, ctx.userId])]

    if (!isGroup) {
      if (allParticipantIds.length !== 2) {
        return NextResponse.json({ error: 'Direct messages require exactly 2 participants' }, { status: 400 })
      }

      const existingChat = await Chat.findOne(
        mergeMongoFilters(workspaceScopedFilter(ctx), {
          isGroup: false,
          participants: { $all: allParticipantIds, $size: 2 },
        })
      ).populate('participants', 'name email image role')

      if (existingChat) {
        return NextResponse.json(existingChat)
      }
    } else if (!name?.trim()) {
      return NextResponse.json({ error: 'Group name is required' }, { status: 400 })
    }

    const newChat = await Chat.create({
      isGroup: isGroup || false,
      name: isGroup ? name.trim() : undefined,
      participants: allParticipantIds,
      admin: isGroup ? ctx.userId : undefined,
      organizationId: ctx.organizationId || undefined,
      workspaceId: ctx.workspaceId || undefined,
    })

    const populatedChat = await Chat.findById(newChat._id).populate(
      'participants',
      'name email image role'
    )

    return NextResponse.json(populatedChat, { status: 201 })
  } catch (error) {
    return tenantErrorResponse(error, 'Internal server error')
  }
}
