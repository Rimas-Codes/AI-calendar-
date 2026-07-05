import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendReminderEmail, type SendEmailResult } from '@/lib/email'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/reminders/email/due
 *
 * Finds events where:
 *   - emailRecipient is set
 *   - emailSent is false
 *   - startAt is in the future (don't email after the event)
 *   - (startAt - 24h) <= now  → the day-before window has arrived
 *
 * Sends the reminder email for each, marks emailSent=true, and returns the
 * list of sent emails (with Ethereal preview URLs or file paths).
 *
 * This endpoint is polled by the client every ~60s. In production you would
 * replace this polling with a server-side cron job (Vercel Cron, etc.).
 */
export async function POST() {
  const now = new Date()
  const dayMs = 24 * 60 * 60 * 1000

  // Find candidates: events with an unsent email reminder whose day-before
  // window has arrived and that haven't started yet.
  const candidates = await db.event.findMany({
    where: {
      emailRecipient: { not: null },
      emailSent: false,
      startAt: { gt: now },
    },
    orderBy: { startAt: 'asc' },
  })

  const dueEvents = candidates.filter((e) => {
    const emailDueAt = new Date(e.startAt.getTime() - dayMs)
    return emailDueAt.getTime() <= now.getTime()
  })

  const sent: Array<{
    eventId: string
    eventTitle: string
    recipient: string
    result: SendEmailResult
  }> = []
  const errors: Array<{ eventId: string; error: string }> = []

  for (const ev of dueEvents) {
    // Atomically claim this event so a parallel poll can't double-send.
    const claim = await db.event.updateMany({
      where: { id: ev.id, emailSent: false },
      data: { emailSent: true, emailSentAt: now },
    })
    if (claim.count === 0) continue // someone else claimed it

    try {
      const result = await sendReminderEmail({
        to: ev.emailRecipient!,
        eventTitle: ev.title,
        startAt: ev.startAt,
        endAt: ev.endAt,
        location: ev.location,
        description: ev.description,
        allDay: ev.allDay,
      })
      sent.push({
        eventId: ev.id,
        eventTitle: ev.title,
        recipient: ev.emailRecipient!,
        result,
      })
    } catch (err) {
      // Roll back the claim so it retries on the next poll.
      await db.event.update({
        where: { id: ev.id },
        data: { emailSent: false, emailSentAt: null },
      })
      errors.push({
        eventId: ev.id,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return NextResponse.json({ sent, errors, checkedAt: now.toISOString() })
}
