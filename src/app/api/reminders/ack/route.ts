import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/reminders/ack
 * Body: { id: string } or { ids: string[] }
 * Marks the given reminder(s) as delivered so they don't fire again.
 */
export async function POST(req: NextRequest) {
  const body = await req.json()
  const ids: string[] = Array.isArray(body.ids)
    ? body.ids
    : body.id
      ? [body.id]
      : []

  if (ids.length === 0) {
    return NextResponse.json({ error: 'No reminder id provided' }, { status: 400 })
  }

  const now = new Date()
  const result = await db.reminder.updateMany({
    where: { id: { in: ids }, delivered: false },
    data: { delivered: true, ackedAt: now },
  })

  return NextResponse.json({ acked: result.count })
}
