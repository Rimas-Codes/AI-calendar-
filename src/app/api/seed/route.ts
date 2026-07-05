import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/seed
 * Creates a small set of demo events so the calendar isn't empty on first load.
 * Idempotent: only seeds if there are fewer than 3 events in the DB.
 */
export async function POST() {
  const count = await db.event.count()
  if (count >= 3) {
    return NextResponse.json({ seeded: 0, message: 'Already seeded.' })
  }

  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)

  const make = (offsetDays: number, hour: number, minutes: number, durationMin: number) => {
    const start = new Date(startOfDay)
    start.setDate(start.getDate() + offsetDays)
    start.setHours(hour, minutes, 0, 0)
    const end = new Date(start.getTime() + durationMin * 60 * 1000)
    return { start, end }
  }

  const samples = [
    {
      title: 'Team stand-up',
      description: 'Daily sync with the engineering team.',
      location: 'Zoom',
      ...make(0, 9, 30, 30),
      color: 'emerald',
      reminderMinutes: 10,
    },
    {
      title: '1:1 with Sarah',
      description: 'Quarterly career check-in.',
      location: 'Meeting room 4',
      ...make(1, 14, 0, 45),
      color: 'amber',
      reminderMinutes: 15,
    },
    {
      title: 'Product roadmap review',
      description: 'Walk through the Q3 roadmap with PM and design.',
      location: 'Conference A',
      ...make(2, 11, 0, 90),
      color: 'rose',
      reminderMinutes: 30,
    },
  ]

  const created = []
  for (const s of samples) {
    const ev = await db.event.create({
      data: {
        title: s.title,
        description: s.description,
        location: s.location,
        startAt: s.start,
        endAt: s.end,
        color: s.color,
        reminderMinutes: s.reminderMinutes,
      },
    })
    created.push(ev.id)

    // Schedule reminder only if it is in the future
    const remindAt = new Date(s.start.getTime() - s.reminderMinutes * 60 * 1000)
    if (remindAt.getTime() > Date.now()) {
      await db.reminder.create({
        data: { eventId: ev.id, remindAt },
      })
    }
  }

  return NextResponse.json({ seeded: created.length, ids: created })
}
