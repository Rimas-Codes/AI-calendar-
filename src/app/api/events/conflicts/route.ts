import { NextRequest, NextResponse } from 'next/server'
import { findConflicts } from '@/lib/calendar'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/events/conflicts
 * Body: { startAt: ISO string, endAt: ISO string, excludeEventId?: string }
 * Returns events that overlap with the [startAt, endAt) window.
 *
 * Used by the AI assistant's "Re-check calendar" button after the user edits
 * the parsed event's date or time.
 */
export async function POST(req: NextRequest) {
  let body: { startAt?: string; endAt?: string; excludeEventId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.startAt || !body.endAt) {
    return NextResponse.json(
      { error: 'startAt and endAt are required (ISO strings).' },
      { status: 400 },
    )
  }

  const start = new Date(body.startAt)
  const end = new Date(body.endAt)
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return NextResponse.json({ error: 'Invalid date.' }, { status: 400 })
  }
  if (end <= start) {
    return NextResponse.json({ error: 'endAt must be after startAt.' }, { status: 400 })
  }

  const conflicts = await findConflicts(start, end, body.excludeEventId)

  return NextResponse.json({ conflicts })
}
