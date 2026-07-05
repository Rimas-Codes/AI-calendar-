import { NextResponse } from 'next/server'
import { getVapidPublicKey } from '@/lib/push'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/push/vapid-public-key
 * Returns the VAPID public key the browser needs to subscribe to push.
 */
export async function GET() {
  const publicKey = getVapidPublicKey()
  if (!publicKey) {
    return NextResponse.json({ error: 'VAPID not configured.' }, { status: 500 })
  }
  return NextResponse.json({ publicKey })
}
