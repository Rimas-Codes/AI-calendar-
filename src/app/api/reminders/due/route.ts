import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/reminders/due
 * Returns reminders that should fire now (remindAt <= now AND not delivered),
 * along with the associated event.
 */
export async function GET() {
  const now = new Date()
  const due = await db.reminder.findMany({
    where: {
      delivered: false,
      remindAt: { lte: now },
    },
    include: { event: true },
    orderBy: { remindAt: 'asc' },
  })

  return NextResponse.json({
    now: now.toISOString(),
    reminders: due.map((r) => ({
      id: r.id,
      remindAt: r.remindAt.toISOString(),
      eventId: r.eventId,
      event: {
        id: r.event.id,
        title: r.event.title,
        startAt: r.event.startAt.toISOString(),
        endAt: r.event.endAt.toISOString(),
        location: r.event.location,
        allDay: r.event.allDay,
      },
    })),
  })
}
