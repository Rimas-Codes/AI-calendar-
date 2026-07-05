import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { syncReminder } from '@/lib/calendar'
import { isValidEmail } from '@/lib/email'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const event = await db.event.findUnique({ where: { id } })
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ event })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const body = await req.json()

  const existing = await db.event.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const startAt = body.startAt ? new Date(body.startAt) : existing.startAt
  const endAt = body.endAt ? new Date(body.endAt) : existing.endAt
  if (endAt <= startAt) {
    return NextResponse.json({ error: 'endAt must be after startAt' }, { status: 400 })
  }

  // Handle emailRecipient: empty string clears it, valid email sets it.
  let emailRecipientUpdate: Record<string, unknown> = {}
  if (body.emailRecipient !== undefined) {
    const val = typeof body.emailRecipient === 'string' ? body.emailRecipient.trim() : ''
    if (val === '') {
      emailRecipientUpdate = { emailRecipient: null, emailSent: false, emailSentAt: null }
    } else if (isValidEmail(val)) {
      // Reset sent flag if the recipient or timing changed
      emailRecipientUpdate = { emailRecipient: val, emailSent: false, emailSentAt: null }
    } else {
      return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 })
    }
  }

  const event = await db.event.update({
    where: { id },
    data: {
      ...(body.title !== undefined ? { title: String(body.title) } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.location !== undefined ? { location: body.location } : {}),
      startAt,
      endAt,
      ...(body.allDay !== undefined ? { allDay: Boolean(body.allDay) } : {}),
      ...(body.color !== undefined ? { color: String(body.color) } : {}),
      ...(body.reminderMinutes !== undefined
        ? { reminderMinutes: Number(body.reminderMinutes) }
        : {}),
      ...emailRecipientUpdate,
    },
  })

  await syncReminder(event.id, startAt, event.reminderMinutes)

  return NextResponse.json({ event })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  // Reminder rows are cascade-deleted by Prisma
  await db.event.deleteMany({ where: { id } })
  return NextResponse.json({ ok: true })
}
