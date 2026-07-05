'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, BellOff, Check, Clock, Mail, MapPin, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { format, isToday, isTomorrow } from 'date-fns'
import { cn } from '@/lib/utils'
import { useDueEmailReminders, useDueReminders, usePushDueReminders } from '@/hooks/use-calendar'
import type { DueReminder, SentEmailEntry } from '@/lib/types'

interface ReminderPanelProps {
  /** Triggered when a brand-new reminder arrives so the page can refresh the calendar. */
  onRemindersChanged?: () => void
}

export function ReminderPanel({ onRemindersChanged }: ReminderPanelProps) {
  const { due, ack, permission, requestPermission } = useDueReminders(30_000)
  const [sentEmails, setSentEmails] = useState<SentEmailEntry[]>([])
  const [mounted, setMounted] = useState(false)
  const previousIdsRef = useRef<Set<string>>(new Set())
  const firedRef = useRef<Set<string>>(new Set())

  // Avoid hydration mismatch: render the same "empty" state on server and
  // first client paint, then update after mount when the polling data arrives.
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  // Poll for due email reminders every 60s. When the server sends any,
  // we add them to the sentEmails list so the user can see the preview.
  useDueEmailReminders(60_000, (entries) => {
    setSentEmails((prev) => [...prev, ...entries])
    onRemindersChanged?.()
  })

  // Poll for due push reminders every 60s. The server broadcasts web-push
  // notifications to all subscribed devices (including Android) and marks
  // the reminders as delivered. The push arrives via the service worker,
  // so it shows even if the PWA is in the background.
  usePushDueReminders(60_000)

  // Fire browser notifications for newly-arrived reminders
  useEffect(() => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    for (const r of due) {
      if (firedRef.current.has(r.id)) continue
      firedRef.current.add(r.id)
      try {
        const start = new Date(r.event.startAt)
        const body = r.event.location
          ? `Starts ${format(start, 'HH:mm')} at ${r.event.location}`
          : `Starts at ${format(start, 'HH:mm')}`
        new Notification(`Reminder: ${r.event.title}`, { body })
      } catch {
        // ignore
      }
    }
  }, [due])

  // Notify parent when the due set changes shape (new reminders arrived)
  useEffect(() => {
    const currentIds = new Set(due.map((r) => r.id))
    const prev = previousIdsRef.current
    let changed = false
    for (const id of currentIds) {
      if (!prev.has(id)) {
        changed = true
        break
      }
    }
    if (changed) onRemindersChanged?.()
    previousIdsRef.current = currentIds
  }, [due, onRemindersChanged])

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Bell className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold leading-tight">Reminders</h2>
              <p className="text-xs text-muted-foreground">
                {mounted && due.length > 0
                  ? `${due.length} due right now`
                  : 'No reminders due — checked every 30s.'}
              </p>
            </div>
          </div>
          {permission !== 'granted' && (
            <Button size="sm" variant="outline" onClick={requestPermission}>
              <Bell className="h-3.5 w-3.5" />
              Enable
            </Button>
          )}
        </div>

        {permission === 'denied' && (
          <div className="flex items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <BellOff className="h-3.5 w-3.5 shrink-0" />
            Browser notifications are blocked. You&apos;ll still see in-app alerts below.
          </div>
        )}

        <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
          <AnimatePresence initial={false}>
            {due.length === 0 && sentEmails.length === 0 && (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center gap-1 py-6 text-center"
              >
                <Clock className="h-5 w-5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">All caught up.</p>
              </motion.div>
            )}
            {due.map((r) => (
              <ReminderItem key={r.id} reminder={r} onDismiss={() => ack([r.id])} />
            ))}
            {sentEmails.map((e) => (
              <SentEmailItem key={`email-${e.eventId}`} entry={e} />
            ))}
          </AnimatePresence>
        </div>
      </CardContent>
    </Card>
  )
}

function ReminderItem({ reminder, onDismiss }: { reminder: DueReminder; onDismiss: () => void }) {
  const start = new Date(reminder.event.startAt)
  const label = isToday(start)
    ? `Today at ${format(start, 'HH:mm')}`
    : isTomorrow(start)
      ? `Tomorrow at ${format(start, 'HH:mm')}`
      : format(start, 'EEE, MMM d · HH:mm')

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 20, transition: { duration: 0.15 } }}
      className={cn(
        'rounded-md border border-amber-200 bg-amber-50 p-2.5 text-sm',
        'dark:border-amber-900 dark:bg-amber-950/40',
      )}
    >
      <div className="flex items-start gap-2">
        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white">
          <Bell className="h-3 w-3" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{reminder.event.title}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
          {reminder.event.location && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {reminder.event.location}
            </p>
          )}
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 shrink-0"
          onClick={onDismiss}
          aria-label="Dismiss reminder"
        >
          <Check className="h-3.5 w-3.5" />
        </Button>
      </div>
    </motion.div>
  )
}

function SentEmailItem({ entry }: { entry: SentEmailEntry }) {
  const { result } = entry
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 20, transition: { duration: 0.15 } }}
      className={cn(
        'rounded-md border border-violet-200 bg-violet-50 p-2.5 text-sm',
        'dark:border-violet-900 dark:bg-violet-950/40',
      )}
    >
      <div className="flex items-start gap-2">
        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-500 text-white">
          <Mail className="h-3 w-3" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{entry.eventTitle}</p>
          <p className="text-xs text-muted-foreground">
            Email reminder sent to{' '}
            <span className="font-medium text-foreground">{entry.recipient}</span>
          </p>
          {result.method === 'smtp' && (
            <p className="mt-0.5 text-[10px] text-violet-700 dark:text-violet-400">
              ✓ Delivered via SMTP ({result.from})
            </p>
          )}
          {result.previewUrl && (
            <a
              href={result.previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-violet-700 underline hover:text-violet-900 dark:text-violet-300 dark:hover:text-violet-200"
            >
              <ExternalLink className="h-3 w-3" />
              Open email preview (Ethereal)
            </a>
          )}
          {result.filePath && (
            <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
              Saved to: {result.filePath}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  )
}
