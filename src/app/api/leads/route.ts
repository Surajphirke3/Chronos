import { connectDB } from '@/lib/mongodb/client'
import { Lead } from '@/lib/mongodb/models/Lead'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { objectIdSchema, paginationSchema, parseWithSchema } from '@/lib/api/validation'
import { z } from 'zod'

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const parsed = parseWithSchema(paginationSchema, {
      limit: searchParams.get('limit') || 50,
      page: searchParams.get('page') || 1,
    })
    if (parsed.ok === false) return parsed.response

    await connectDB()

    const filter = { ownerId: session.user.id }
    const page = parsed.data.page || 1
    const skip = (page - 1) * parsed.data.limit

    const [leads, total] = await Promise.all([
      Lead.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(parsed.data.limit)
        .lean(),
      Lead.countDocuments(filter),
    ])

    return NextResponse.json({
      leads,
      pagination: {
        page,
        limit: parsed.data.limit,
        total,
        totalPages: Math.ceil(total / parsed.data.limit) || 1,
        hasMore: skip + leads.length < total,
      },
    })
  } catch (error) {
    console.error('Error fetching leads')
    return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const idParsed = parseWithSchema(z.object({ id: objectIdSchema }), {
      id: searchParams.get('id'),
    })
    if (idParsed.ok === false) return idParsed.response

    await connectDB()
    await Lead.deleteOne({ _id: idParsed.data.id, ownerId: session.user.id })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting lead')
    return NextResponse.json({ error: 'Failed to delete lead' }, { status: 500 })
  }
}
