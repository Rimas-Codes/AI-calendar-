import { NextRequest, NextResponse } from 'next/server'
import { savePushSubscription } from '@/lib/push'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/push/subscribe
 * Body: { endpoint, keys: { p256dh, auth } }
 * Saves (or updates) a push subscription from the browser.
 */
export async function POST(req: NextRequest) {
  let body: { endpoint?: string; keys?: { p256dh: string; auth: string } }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    return NextResponse.json(
      { error: 'endpoint, keys.p256dh, and keys.auth are required.' },
      { status: 400 },
    )
  }
  await savePushSubscription(body)
  return NextResponse.json({ ok: true })
}
