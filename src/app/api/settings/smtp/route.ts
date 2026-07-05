import { NextRequest, NextResponse } from 'next/server'
import {
  clearSmtpSettings,
  getSmtpSettings,
  maskPassword,
  mergePassword,
  saveSmtpSettings,
  type SmtpSettings,
} from '@/lib/smtp-settings'
import { isValidEmail } from '@/lib/email'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/settings/smtp
 * Returns the current SMTP settings with the password masked.
 */
export async function GET() {
  const settings = await getSmtpSettings()
  return NextResponse.json({ settings: maskPassword(settings) })
}

/**
 * PUT /api/settings/smtp
 * Body: SmtpSettings (password may be the mask "••••••••" to keep the existing one)
 * Saves the settings and returns the masked version.
 */
export async function PUT(req: NextRequest) {
  let body: Partial<SmtpSettings>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Basic validation
  if (body.enabled) {
    if (!body.host || !body.host.trim()) {
      return NextResponse.json({ error: 'Host is required when SMTP is enabled.' }, { status: 400 })
    }
    if (!body.port || body.port < 1 || body.port > 65535) {
      return NextResponse.json({ error: 'Port must be between 1 and 65535.' }, { status: 400 })
    }
    if (!body.user || !body.user.trim()) {
      return NextResponse.json({ error: 'Username is required when SMTP is enabled.' }, { status: 400 })
    }
    if (!body.fromEmail || !isValidEmail(body.fromEmail)) {
      return NextResponse.json({ error: 'A valid "From" email is required when SMTP is enabled.' }, { status: 400 })
    }
  }

  const saved = await getSmtpSettings()
  const merged = mergePassword(body, saved)
  await saveSmtpSettings(merged)
  return NextResponse.json({ settings: maskPassword(merged) })
}

/**
 * DELETE /api/settings/smtp
 * Clears SMTP settings, reverting to the Ethereal fallback.
 */
export async function DELETE() {
  await clearSmtpSettings()
  return NextResponse.json({ ok: true })
}
