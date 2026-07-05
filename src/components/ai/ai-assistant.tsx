'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  Mail,
  RefreshCw,
  Settings,
  Sparkles,
  Wand2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import type { AIParseResponse, CalendarEvent, EventColor, ParsedEvent } from '@/lib/types'
import { COLOR_OPTIONS, COLOR_STYLES } from '@/lib/types'
import { createEvent } from '@/hooks/use-calendar'

const SAMPLE_TEXT = `Hi there,

Just confirming our meeting next Tuesday at 2pm Pacific. We'll be on Zoom — I'll send the link 5 minutes before. Should take about 30 minutes.

Looking forward to it!

— Alex`

interface AIAssistantProps {
  onBooked: (event: CalendarEvent) => void
  onOpenSettings?: () => void
}

/**
 * Safely parse a fetch response as JSON. If the response is HTML (e.g. a
 * Next.js error page from a crashed server), throw a helpful error instead
 * of the cryptic "Unexpected token '<'".
 */
async function safeJson<T = any>(res: Response): Promise<T> {
  const text = await res.text()
  try {
    return JSON.parse(text) as T
  } catch {
    if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
      throw new Error(
        `Server returned an HTML error page (HTTP ${res.status}). The Next.js server may have crashed — check the terminal window running Cadence for error messages.`,
      )
    }
    throw new Error(`Server returned an unexpected response (HTTP ${res.status}): ${text.slice(0, 200)}`)
  }
}

/** Local mutable copy of ParsedEvent that the user can edit before booking. */
interface EditableEvent {
  title: string
  description: string
  location: string
  startAt: string // ISO
  endAt: string // ISO
  allDay: boolean
  reminderMinutes: number
  color: EventColor
  emailRecipient: string
}

function parsedToEditable(p: ParsedEvent): EditableEvent {
  return {
    title: p.title,
    description: p.description ?? '',
    location: p.location ?? '',
    startAt: p.startAt,
    endAt: p.endAt,
    allDay: p.allDay,
    reminderMinutes: p.reminderMinutes,
    color: 'emerald',
    emailRecipient: '',
  }
}

/** Convert a Date to the value expected by <input type="datetime-local">. */
function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function AIAssistant({ onBooked, onOpenSettings }: AIAssistantProps) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AIParseResponse | null>(null)
  const [edited, setEdited] = useState<EditableEvent | null>(null)
  const [conflicts, setConflicts] = useState<CalendarEvent[]>([])
  const [rechecking, setRechecking] = useState(false)
  const [booking, setBooking] = useState(false)
  const [bookedEvent, setBookedEvent] = useState<CalendarEvent | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sendingTest, setSendingTest] = useState(false)
  const [testEmailResult, setTestEmailResult] = useState<{
    previewUrl?: string
    filePath?: string
    method: string
  } | null>(null)
  const [smtpActive, setSmtpActive] = useState<boolean | null>(null)
  const [aiReady, setAiReady] = useState<boolean | null>(null)
  const [aiProvider, setAiProvider] = useState<string>('')

  // Fetch SMTP + AI status once on mount
  useEffect(() => {
    fetch('/api/settings/smtp', { cache: 'no-store' })
      .then(async (r) => safeJson(r))
      .then((data) => {
        const s = data.settings
        setSmtpActive(s?.enabled && s?.hasPassword && !!s?.host && !!s?.fromEmail)
      })
      .catch(() => setSmtpActive(false))

    fetch('/api/settings/ai', { cache: 'no-store' })
      .then(async (r) => safeJson(r))
      .then((data) => {
        const s = data.settings
        setAiProvider(s?.provider ?? 'groq')
        const presetRequiresKey = s?.provider !== 'ollama'
        setAiReady(!presetRequiresKey || s?.hasApiKey)
      })
      .catch(() => setAiReady(false))
  }, [])

  const handleSendTestEmail = async () => {
    if (!bookedEvent?.emailRecipient) return
    setSendingTest(true)
    setError(null)
    setTestEmailResult(null)
    try {
      const res = await fetch('/api/reminders/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: bookedEvent.id }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `Failed (${res.status})`)
      }
      const data = await res.json()
      setTestEmailResult({
        previewUrl: data.result?.previewUrl,
        filePath: data.result?.filePath,
        method: data.result?.method ?? 'unknown',
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSendingTest(false)
    }
  }

  const handleAnalyze = async () => {
    if (text.trim().length < 5) return
    setLoading(true)
    setError(null)
    setResult(null)
    setEdited(null)
    setConflicts([])
    setBookedEvent(null)
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      const res = await fetch('/api/ai/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, timezone: tz }),
      })
      const data = await safeJson<AIParseResponse>(res)
      if (!res.ok) {
        throw new Error((data as any).error || `Failed (${res.status})`)
      }
      setResult(data)
      if (data.parsed) {
        setEdited(parsedToEditable(data.parsed))
        setConflicts(data.conflicts ?? [])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  /** Re-run conflict detection against the user's edited date/time. */
  const handleRecheck = async () => {
    if (!edited) return
    setRechecking(true)
    setError(null)
    try {
      const res = await fetch('/api/events/conflicts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startAt: edited.startAt, endAt: edited.endAt }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `Failed (${res.status})`)
      }
      const data = await res.json()
      setConflicts(data.conflicts as CalendarEvent[])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setRechecking(false)
    }
  }

  const handleBook = async () => {
    if (!edited) return
    setBooking(true)
    setError(null)
    try {
      const trimmedEmail = edited.emailRecipient.trim()
      const ev = await createEvent({
        title: edited.title.trim() || 'Untitled event',
        description: edited.description.trim() || null,
        location: edited.location.trim() || null,
        startAt: edited.startAt,
        endAt: edited.endAt,
        allDay: edited.allDay,
        color: edited.color,
        reminderMinutes: edited.reminderMinutes,
        sourceText: text,
        emailRecipient: trimmedEmail || null,
      })
      setBookedEvent(ev)
      onBooked(ev)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBooking(false)
    }
  }

  const handleReset = () => {
    setText('')
    setResult(null)
    setEdited(null)
    setConflicts([])
    setBookedEvent(null)
    setError(null)
    setTestEmailResult(null)
    setSendingTest(false)
  }

  const parsed = result?.parsed ?? null
  const hasConflicts = conflicts.length > 0

  return (
    <Card className="flex h-full flex-col">
      <CardContent className="flex h-full flex-col gap-3 p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold leading-tight">AI Assistant</h2>
            <p className="text-xs text-muted-foreground">
              Paste an email or message — it will check your calendar and book it.
            </p>
          </div>
        </div>

        {/* AI not configured banner */}
        {aiReady === false && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs dark:border-amber-800 dark:bg-amber-950/40">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div className="flex-1 space-y-1">
                <p className="font-medium text-amber-900 dark:text-amber-200">
                  AI provider not configured
                </p>
                <p className="text-amber-800 dark:text-amber-300">
                  The AI assistant needs a provider API key to parse events. Get a free key from
                  Groq (recommended) or Google Gemini — takes 30 seconds.
                </p>
                {onOpenSettings && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onOpenSettings}
                    className="mt-2 h-7 border-amber-400 bg-white text-xs text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-200"
                  >
                    <Settings className="h-3 w-3" />
                    Configure AI provider
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
        {aiReady === true && (
          <div className="flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
            <CheckCircle2 className="h-3 w-3" />
            AI ready — using {aiProvider}
          </div>
        )}

        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste an email, invite, or message containing an event…"
          rows={5}
          className="resize-none font-mono text-xs"
          disabled={loading || booking}
        />

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={handleAnalyze} disabled={loading || text.trim().length < 5}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyzing…
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4" />
                Analyze &amp; check calendar
              </>
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setText(SAMPLE_TEXT)}
            disabled={loading || !!text}
            className="text-xs"
          >
            Use sample
          </Button>
          {(text || result) && (
            <Button variant="ghost" size="sm" onClick={handleReset} className="ml-auto text-xs">
              <X className="h-3 w-3" />
              Clear
            </Button>
          )}
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <AnimatePresence mode="wait">
            {loading && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center gap-3 py-12 text-center"
              >
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  Reading your message, extracting the event, and checking the calendar…
                </p>
              </motion.div>
            )}

            {!loading && bookedEvent && (
              <motion.div
                key="booked"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-700 dark:bg-emerald-950/40"
              >
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  <div className="flex-1 space-y-2">
                    <h3 className="font-semibold text-emerald-900 dark:text-emerald-200">
                      Booked: {bookedEvent.title}
                    </h3>
                    <p className="text-sm text-emerald-800 dark:text-emerald-300">
                      {format(new Date(bookedEvent.startAt), 'EEEE, MMM d · HH:mm')} →{' '}
                      {format(new Date(bookedEvent.endAt), 'HH:mm')}
                    </p>
                    <p className="text-xs text-emerald-700 dark:text-emerald-400">
                      In-app reminder set for {bookedEvent.reminderMinutes} min before.
                    </p>
                    {bookedEvent.emailRecipient && (
                      <div className="space-y-1.5">
                        <p className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
                          <Mail className="h-3 w-3" />
                          Email reminder will be sent to{' '}
                          <span className="font-medium">{bookedEvent.emailRecipient}</span> the day
                          before.
                        </p>
                        {smtpActive ? (
                          <div className="rounded-md bg-emerald-50 px-2 py-1.5 text-[10px] text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                            <strong>SMTP active</strong> — reminder emails will be delivered to the
                            real inbox. Tap below to send a test email now.
                          </div>
                        ) : (
                          <div className="rounded-md bg-amber-50 px-2 py-1.5 text-[10px] text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                            <strong>Demo mode:</strong> Emails are sent via{' '}
                            <a
                              href="https://ethereal.email"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline"
                            >
                              Ethereal
                            </a>{' '}
                            (a test service). The email is{' '}
                            <strong>NOT delivered to the real inbox</strong> — you get a preview URL
                            instead. To send real emails, click the{' '}
                            <span className="font-medium">Settings</span> button (gear icon) in the
                            header and configure your SMTP credentials.
                          </div>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleSendTestEmail}
                          disabled={sendingTest}
                          className="h-7 border-emerald-300 bg-white text-xs text-emerald-800 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200 dark:hover:bg-emerald-900/60"
                        >
                          {sendingTest ? (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Sending…
                            </>
                          ) : smtpActive ? (
                            <>
                              <Mail className="h-3 w-3" />
                              Send test email
                            </>
                          ) : (
                            <>
                              <Mail className="h-3 w-3" />
                              Preview test email
                            </>
                          )}
                        </Button>
                        {testEmailResult?.previewUrl && (
                          <a
                            href={testEmailResult.previewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs font-medium text-emerald-700 underline hover:text-emerald-900 dark:text-emerald-300"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Open email preview in new tab
                          </a>
                        )}
                        {testEmailResult?.method === 'smtp' && (
                          <p className="text-[10px] text-emerald-700 dark:text-emerald-400">
                            ✓ Email sent via SMTP to {bookedEvent.emailRecipient}. Check the inbox
                            (and spam folder on first send).
                          </p>
                        )}
                        {testEmailResult?.filePath && (
                          <p className="text-[10px] text-emerald-700 dark:text-emerald-400">
                            ✓ Email saved to: {testEmailResult.filePath}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {!loading && !bookedEvent && edited && (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-3"
              >
                <EditableEventForm
                  edited={edited}
                  onChange={setEdited}
                  disabled={booking}
                  parsed={parsed}
                />

                {parsed && (
                  <AIResolutionPanel parsed={parsed} />
                )}

                {hasConflicts && (
                  <ConflictList conflicts={conflicts} />
                )}

                <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-foreground/80">
                  <span className="font-medium text-primary">
                    Review and edit the fields above
                  </span>{' '}
                  — fix any mistake before booking. If you changed the date or time, tap{' '}
                  <span className="font-medium">Re-check calendar</span> to refresh the conflict
                  list.
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRecheck}
                    disabled={rechecking || booking}
                  >
                    {rechecking ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Checking…
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-3.5 w-3.5" />
                        Re-check calendar
                      </>
                    )}
                  </Button>
                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    <Button variant="ghost" onClick={handleReset} disabled={booking}>
                      Discard
                    </Button>
                    {!hasConflicts && (
                      <Button onClick={handleBook} disabled={booking}>
                        {booking ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Booking…
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-4 w-4" />
                            Confirm &amp; book it
                          </>
                        )}
                      </Button>
                    )}
                    {hasConflicts && (
                      <>
                        <span className="text-xs text-amber-700 dark:text-amber-300">
                          Slot is busy —
                        </span>
                        <Button variant="outline" onClick={handleBook} disabled={booking}>
                          Book anyway
                        </Button>
                      </>
                    )}
                  </div>
                </div>

              </motion.div>
            )}

            {!loading && !edited && !error && (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                <div className="rounded-full bg-muted p-3">
                  <CalendarClock className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Paste a message above and tap <span className="font-medium">Analyze</span> to let
                  the AI extract the event and check your calendar.
                </p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </CardContent>
    </Card>
  )
}

/* -------------------------------------------------------------------------- */
/* Banner showing original time → user's local time conversion               */
/* -------------------------------------------------------------------------- */

function OriginalTimeBanner({
  parsed,
  localStart,
  localEnd,
  tzLabel,
}: {
  parsed: ParsedEvent
  localStart: Date
  localEnd: Date
  tzLabel: string
}) {
  const origTime = parsed.originalTime
  const origTz = parsed.originalTimezone

  // Get the user's timezone display name (e.g. "Pacific/Auckland" → "New Zealand Time" or just the IANA name)
  const userTzName = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'your timezone'
    } catch {
      return 'your timezone'
    }
  }, [])

  if (!origTime && !origTz) return null

  const localTimeStr = `${format(localStart, 'EEE, MMM d · HH:mm')} → ${format(localEnd, 'HH:mm')}`

  return (
    <div className="rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-xs dark:border-violet-800 dark:bg-violet-950/40">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-medium text-violet-900 dark:text-violet-200">Original:</span>
        <span className="text-violet-800 dark:text-violet-300">
          {origTime && <span className="font-medium">{origTime}</span>}
          {origTz && <span> ({origTz})</span>}
        </span>
        <span className="text-violet-400 dark:text-violet-500">→</span>
        <span className="font-medium text-violet-900 dark:text-violet-200">Your time:</span>
        <span className="text-violet-800 dark:text-violet-300">
          {localTimeStr} <span className="text-violet-500 dark:text-violet-400">({tzLabel}, {userTzName})</span>
        </span>
      </div>
      <p className="mt-1 text-[10px] text-violet-700 dark:text-violet-400">
        The AI converted the original time to your local timezone. If this looks wrong — e.g. you
        actually want the event at {origTime || 'that time'} <em>your</em> time — edit the Starts/Ends fields below.
      </p>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Editable form shown in the confirmation stage                              */
/* -------------------------------------------------------------------------- */

function EditableEventForm({
  edited,
  onChange,
  disabled,
  parsed,
}: {
  edited: EditableEvent
  onChange: (next: EditableEvent) => void
  disabled?: boolean
  parsed?: ParsedEvent | null
}) {
  const start = new Date(edited.startAt)
  const end = new Date(edited.endAt)
  const tzLabel = useMemo(() => {
    try {
      const offset = -start.getTimezoneOffset()
      const sign = offset >= 0 ? '+' : '-'
      const hh = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0')
      const mm = String(Math.abs(offset) % 60).padStart(2, '0')
      return `UTC${sign}${hh}:${mm}`
    } catch {
      return 'local'
    }
  }, [start])

  const patch = (p: Partial<EditableEvent>) => onChange({ ...edited, ...p })

  const handleStartChange = (val: string) => {
    const d = new Date(val)
    if (!isNaN(d.getTime())) {
      // Preserve duration if end is currently after start
      const oldDuration = end.getTime() - start.getTime()
      const newEnd = new Date(d.getTime() + (oldDuration > 0 ? oldDuration : 60 * 60 * 1000))
      patch({ startAt: d.toISOString(), endAt: newEnd.toISOString() })
    }
  }

  const handleEndChange = (val: string) => {
    const d = new Date(val)
    if (!isNaN(d.getTime())) {
      patch({ endAt: d.toISOString() })
    }
  }

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="ai-title" className="text-xs text-muted-foreground">
          Event details — edit anything below
        </Label>
        <span className="text-[10px] text-muted-foreground">your time ({tzLabel})</span>
      </div>

      {parsed && (parsed.originalTime || parsed.originalTimezone) && (
        <OriginalTimeBanner parsed={parsed} localStart={start} localEnd={end} tzLabel={tzLabel} />
      )}

      <Input
        id="ai-title"
        value={edited.title}
        onChange={(e) => patch({ title: e.target.value })}
        placeholder="Event title"
        disabled={disabled}
        className="font-medium"
      />

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor="ai-start" className="text-xs">
            Starts
          </Label>
          <Input
            id="ai-start"
            type="datetime-local"
            value={toLocalInput(start)}
            onChange={(e) => handleStartChange(e.target.value)}
            disabled={disabled}
            className="text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ai-end" className="text-xs">
            Ends
          </Label>
          <Input
            id="ai-end"
            type="datetime-local"
            value={toLocalInput(end)}
            onChange={(e) => handleEndChange(e.target.value)}
            disabled={disabled}
            className="text-xs"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor="ai-location" className="text-xs">
            Location
          </Label>
          <Input
            id="ai-location"
            value={edited.location}
            onChange={(e) => patch({ location: e.target.value })}
            placeholder="Optional"
            disabled={disabled}
            className="text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ai-reminder" className="text-xs">
            Reminder
          </Label>
          <Select
            value={String(edited.reminderMinutes)}
            onValueChange={(v) => patch({ reminderMinutes: Number(v) })}
            disabled={disabled}
          >
            <SelectTrigger id="ai-reminder" className="h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">At time of event</SelectItem>
              <SelectItem value="5">5 minutes before</SelectItem>
              <SelectItem value="10">10 minutes before</SelectItem>
              <SelectItem value="15">15 minutes before</SelectItem>
              <SelectItem value="30">30 minutes before</SelectItem>
              <SelectItem value="60">1 hour before</SelectItem>
              <SelectItem value="120">2 hours before</SelectItem>
              <SelectItem value="1440">1 day before</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="ai-description" className="text-xs">
          Description
        </Label>
        <Textarea
          id="ai-description"
          value={edited.description}
          onChange={(e) => patch({ description: e.target.value })}
          placeholder="Optional notes, agenda, links…"
          rows={2}
          disabled={disabled}
          className="resize-none text-xs"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="ai-email" className="text-xs flex items-center gap-1">
          <Mail className="h-3 w-3" />
          Email reminder (optional)
        </Label>
        <Input
          id="ai-email"
          type="email"
          inputMode="email"
          value={edited.emailRecipient}
          onChange={(e) => patch({ emailRecipient: e.target.value })}
          placeholder="you@example.com"
          disabled={disabled}
          className="text-xs"
        />
        <p className="text-[10px] text-muted-foreground">
          If set, a reminder email will be sent to this address the day before the event. (Demo
          sends via Ethereal — see note after booking.)
        </p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Label htmlFor="ai-all-day" className="text-xs">
            All-day
          </Label>
          <Switch
            id="ai-all-day"
            checked={edited.allDay}
            onCheckedChange={(v) => patch({ allDay: v })}
            disabled={disabled}
          />
        </div>
        <div className="flex items-center gap-1.5">
          {COLOR_OPTIONS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Color ${c}`}
              onClick={() => patch({ color: c })}
              disabled={disabled}
              className={cn(
                'h-5 w-5 rounded-full border-2 transition-transform',
                c === 'emerald' && 'bg-emerald-500',
                c === 'amber' && 'bg-amber-500',
                c === 'rose' && 'bg-rose-500',
                c === 'violet' && 'bg-violet-500',
                c === 'cyan' && 'bg-cyan-500',
                c === 'slate' && 'bg-slate-500',
                edited.color === c
                  ? 'border-foreground scale-110'
                  : 'border-transparent hover:scale-105',
              )}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Read-only panel showing how the AI originally resolved the event          */
/* -------------------------------------------------------------------------- */

function AIResolutionPanel({ parsed }: { parsed: ParsedEvent }) {
  const confidenceColor =
    parsed.confidence === 'high'
      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
      : parsed.confidence === 'medium'
        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
        : 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200'

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-1.5">
      <div className="flex items-center gap-2">
        <Sparkles className="h-3 w-3 text-primary" />
        <span className="text-xs font-medium text-primary">AI&apos;s original read</span>
        <Badge variant="outline" className={cn('ml-auto text-[10px]', confidenceColor)}>
          {parsed.confidence}
        </Badge>
      </div>
      {parsed.resolution && (
        <p className="text-xs text-foreground/80">{parsed.resolution}</p>
      )}
      {parsed.notes && (
        <p className="text-xs text-amber-800 dark:text-amber-200">⚠ {parsed.notes}</p>
      )}
      <p className="text-[10px] text-muted-foreground italic">
        Edit the fields above if anything here looks wrong.
      </p>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Conflict list                                                              */
/* -------------------------------------------------------------------------- */

function ConflictList({ conflicts }: { conflicts: CalendarEvent[] }) {
  return (
    <div className="rounded-lg border border-rose-300 bg-rose-50 p-3 dark:border-rose-800 dark:bg-rose-950/30">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-rose-900 dark:text-rose-200">
        <AlertCircle className="h-4 w-4" />
        {conflicts.length} conflicting {conflicts.length === 1 ? 'event' : 'events'} on your
        calendar
      </div>
      <ul className="space-y-1.5">
        {conflicts.map((c) => {
          const styles =
            COLOR_STYLES[(c.color as keyof typeof COLOR_STYLES) ?? 'emerald'] ?? COLOR_STYLES.emerald
          return (
            <li
              key={c.id}
              className="flex items-center gap-2 rounded border border-rose-200 bg-white px-2 py-1.5 text-xs dark:border-rose-900 dark:bg-rose-950/50"
            >
              <span className={cn('h-2 w-2 rounded-full', styles.dot)} />
              <span className="font-medium">{c.title}</span>
              <span className="ml-auto flex items-center gap-1 text-muted-foreground">
                <Clock className="h-3 w-3" />
                {format(new Date(c.startAt), 'MMM d, HH:mm')} – {format(new Date(c.endAt), 'HH:mm')}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}


