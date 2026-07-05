import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { broadcastPush } from '@/lib/push'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/reminders/push/due
 *
 * Finds Reminder rows that should fire now (remindAt <= now AND not delivered),
 * broadcasts a web-push notification to all subscribed devices, then marks
 * them as delivered.
 *
 * IMPORTANT: if there are NO subscribed devices, this endpoint leaves the
 * reminders alone (does not mark them delivered) so the in-app reminder panel
 * can still surface them via /api/reminders/due. This way, users who haven't
 * enabled push still get in-app toasts; users who have enabled push get native
 * notifications via the service worker.
 *
 * Polled by the client every 60s. In production, replace with a server cron.
 */
export async function POST() {
  const now = new Date()

  // Don't do anything if nobody has subscribed to push — let the in-app
  // reminder poller handle it instead.
  const subCount = await db.pushSubscription.count()
  if (subCount === 0) {
    return NextResponse.json({ pushed: [], count: 0, checkedAt: now.toISOString(), skipped: true })
  }

  const due = await db.reminder.findMany({
    where: {
      delivered: false,
      remindAt: { lte: now },
    },
    include: { event: true },
    orderBy: { remindAt: 'asc' },
  })

  const pushed: Array<{ reminderId: string; eventTitle: string }> = []

  for (const r of due) {
    // Atomically claim this reminder so a parallel poll can't double-push.
    const claim = await db.reminder.updateMany({
      where: { id: r.id, delivered: false },
      data: { delivered: true, ackedAt: now },
    })
    if (claim.count === 0) continue

    const ev = r.event
    const start = ev.startAt
    const timeStr = ev.allDay
      ? 'all day'
      : start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

    await broadcastPush({
      title: `Reminder: ${ev.title}`,
      body: ev.location
        ? `Starts ${timeStr} at ${ev.location}`
        : `Starts at ${timeStr}`,
      url: '/',
      tag: `reminder-${r.id}`,
    })
    pushed.push({ reminderId: r.id, eventTitle: ev.title })
  }

  return NextResponse.json({
    pushed,
    count: pushed.length,
    checkedAt: now.toISOString(),
  })
}
