'use client'

import { useEffect, useState, useCallback } from 'react'
import type { CalendarEvent, DueReminder, SentEmailEntry } from '@/lib/types'

/** LocalStorage-backed store for the calendar events.
 *  The page calls refresh() after mutations; polling is kept in the reminder hook.
 */
export function useEvents(monthStart: Date, monthEnd: Date) {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const from = monthStart.toISOString()
      const to = monthEnd.toISOString()
      const res = await fetch(`/api/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, {
        cache: 'no-store',
      })
      if (!res.ok) throw new Error(`Failed to load events: ${res.status}`)
      const data = await res.json()
      setEvents(data.events as CalendarEvent[])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [monthStart, monthEnd])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const from = monthStart.toISOString()
        const to = monthEnd.toISOString()
        const res = await fetch(
          `/api/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
          { cache: 'no-store' },
        )
        if (!res.ok) throw new Error(`Failed to load events: ${res.status}`)
        const data = await res.json()
        if (!cancelled) {
          setEvents(data.events as CalendarEvent[])
          setError(null)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    // Defer to next frame so we don't synchronously setState in the effect body
    const id = requestAnimationFrame(() => {
      if (cancelled) return
      setLoading(true)
      run()
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(id)
    }
  }, [monthStart, monthEnd])

  return { events, loading, error, refresh }
}

/** Creates a new event via POST /api/events. */
export async function createEvent(input: {
  title: string
  description?: string | null
  location?: string | null
  startAt: string
  endAt: string
  allDay?: boolean
  color?: string
  reminderMinutes?: number
  sourceText?: string | null
  emailRecipient?: string | null
}): Promise<CalendarEvent> {
  const res = await fetch('/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Failed to create event (${res.status})`)
  }
  const data = await res.json()
  return data.event as CalendarEvent
}

export async function updateEvent(
  id: string,
  input: Partial<{
    title: string
    description: string | null
    location: string | null
    startAt: string
    endAt: string
    allDay: boolean
    color: string
    reminderMinutes: number
    emailRecipient: string | null
  }>,
): Promise<CalendarEvent> {
  const res = await fetch(`/api/events/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Failed to update event (${res.status})`)
  }
  const data = await res.json()
  return data.event as CalendarEvent
}

export async function deleteEvent(id: string): Promise<void> {
  const res = await fetch(`/api/events/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Failed to delete event (${res.status})`)
}

/**
 * Polls /api/reminders/due every `intervalMs` milliseconds.
 * Returns the list of due (not-yet-acked) reminders.
 * Calling `ack(ids)` marks them delivered so they don't re-fire.
 */
export function useDueReminders(intervalMs: number = 30_000) {
  const [due, setDue] = useState<DueReminder[]>([])
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied',
  )

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/reminders/due', { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      setDue(data.reminders as DueReminder[])
    } catch {
      // silent fail
    }
  }, [])

  const ack = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return
    setDue((prev) => prev.filter((r) => !ids.includes(r.id)))
    try {
      await fetch('/api/reminders/ack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      })
    } catch {
      // ignore — server will still dedupe on next poll because they were marked delivered
    }
  }, [])

  const requestPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') return
    const p = await Notification.requestPermission()
    setPermission(p)
  }, [])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const res = await fetch('/api/reminders/due', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled) setDue(data.reminders as DueReminder[])
      } catch {
        // silent fail
      }
    }
    // Defer first poll to next frame so we don't synchronously setState in the effect body
    const id = requestAnimationFrame(() => {
      if (cancelled) return
      run()
    })
    const t = setInterval(run, intervalMs)
    return () => {
      cancelled = true
      cancelAnimationFrame(id)
      clearInterval(t)
    }
  }, [intervalMs])

  return { due, ack, permission, requestPermission, refresh }
}

/**
 * Result of triggering the email reminder send (manual test or due poll).
 */
export interface SendTestEmailResult {
  result: SentEmailResult
  eventId: string
}

/** Send a day-before reminder email for an event immediately (demo/testing). */
export async function sendTestEmail(eventId: string): Promise<SendTestEmailResult> {
  const res = await fetch('/api/reminders/email/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventId }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Failed to send email (${res.status})`)
  }
  return (await res.json()) as SendTestEmailResult
}

/**
 * Polls /api/reminders/email/due every `intervalMs` milliseconds.
 * The server sends due emails and returns the list of sent emails (with
 * Ethereal preview URLs or file paths). Fires `onSent` for each batch.
 */
export function useDueEmailReminders(
  intervalMs: number,
  onSent?: (entries: SentEmailEntry[]) => void,
) {
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const res = await fetch('/api/reminders/email/due', {
          method: 'POST',
          cache: 'no-store',
        })
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        setLastChecked(new Date())
        if (data.sent && data.sent.length > 0) {
          onSent?.(data.sent as SentEmailEntry[])
        }
      } catch {
        // silent fail
      }
    }
    const id = requestAnimationFrame(() => {
      if (cancelled) return
      run()
    })
    const t = setInterval(run, intervalMs)
    return () => {
      cancelled = true
      cancelAnimationFrame(id)
      clearInterval(t)
    }
  }, [intervalMs, onSent])

  return { lastChecked }
}

/**
 * Polls /api/reminders/push/due every `intervalMs` milliseconds.
 * The server finds due reminders, broadcasts web-push notifications to all
 * subscribed devices, and marks the reminders as delivered. This is what makes
 * notifications appear on Android/desktop even when the PWA is backgrounded —
 * the service worker wakes up on push and shows a native notification.
 */
export function usePushDueReminders(intervalMs: number = 60_000) {
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const res = await fetch('/api/reminders/push/due', {
          method: 'POST',
          cache: 'no-store',
        })
        if (!res.ok) return
        if (cancelled) return
        setLastChecked(new Date())
      } catch {
        // silent fail
      }
    }
    const id = requestAnimationFrame(() => {
      if (cancelled) return
      run()
    })
    const t = setInterval(run, intervalMs)
    return () => {
      cancelled = true
      cancelAnimationFrame(id)
      clearInterval(t)
    }
  }, [intervalMs])

  return { lastChecked }
}
