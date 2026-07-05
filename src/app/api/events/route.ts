import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { syncReminder } from '@/lib/calendar'
import { isValidEmail } from '@/lib/email'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/events?from=ISO&to=ISO
 * Returns events whose [startAt, endAt) overlaps with the [from, to) window.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const fromStr = searchParams.get('from')
  const toStr = searchParams.get('to')

  let from: Date | undefined
  let to: Date | undefined
  if (fromStr) from = new Date(fromStr)
  if (toStr) to = new Date(toStr)

  const events = await db.event.findMany({
    where: {
      AND: [
        from ? { endAt: { gt: from } } : {},
        to ? { startAt: { lt: to } } : {},
      ],
    },
    orderBy: { startAt: 'asc' },
  })

  return NextResponse.json({ events })
}

/**
 * POST /api/events
 * Body: { title, description?, location?, startAt, endAt, allDay?, color?,
 *        reminderMinutes?, sourceText?, emailRecipient? }
 */
export async function POST(req: NextRequest) {
  const body = await req.json()
  const required = ['title', 'startAt', 'endAt']
  for (const k of required) {
    if (!body[k]) {
      return NextResponse.json({ error: `Missing field: ${k}` }, { status: 400 })
    }
  }

  const startAt = new Date(body.startAt)
  const endAt = new Date(body.endAt)
  if (endAt <= startAt) {
    return NextResponse.json({ error: 'endAt must be after startAt' }, { status: 400 })
  }

  let emailRecipient: string | null = null
  if (typeof body.emailRecipient === 'string' && body.emailRecipient.trim()) {
    const trimmed = body.emailRecipient.trim()
    if (!isValidEmail(trimmed)) {
      return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 })
    }
    emailRecipient = trimmed
  }

  const event = await db.event.create({
    data: {
      title: String(body.title),
      description: body.description ?? null,
      location: body.location ?? null,
      startAt,
      endAt,
      allDay: Boolean(body.allDay ?? false),
      color: String(body.color ?? 'emerald'),
      reminderMinutes: Number(body.reminderMinutes ?? 15),
      sourceText: body.sourceText ?? null,
      emailRecipient,
    },
  })

  await syncReminder(event.id, startAt, event.reminderMinutes)

  return NextResponse.json({ event }, { status: 201 })
}
