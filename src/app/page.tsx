'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  addMonths,
  endOfMonth,
  format,
  isSameDay,
  startOfMonth,
  subMonths,
} from 'date-fns'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Settings,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { ThemeToggle } from '@/components/theme-toggle'
import { SettingsDialog } from '@/components/settings/settings-dialog'
import { MonthCalendar } from '@/components/calendar/month-calendar'
import { EventFormDialog, type EventFormValues } from '@/components/calendar/event-form-dialog'
import { AIAssistant } from '@/components/ai/ai-assistant'
import { ReminderPanel } from '@/components/ai/reminder-panel'
import { PwaInstallCard } from '@/components/pwa/install-card'

import {
  createEvent,
  deleteEvent,
  updateEvent,
  useEvents,
} from '@/hooks/use-calendar'
import type { CalendarEvent, EventColor } from '@/lib/types'
import { COLOR_STYLES } from '@/lib/types'
import { cn } from '@/lib/utils'

export default function Home() {
  const [monthDate, setMonthDate] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)
  const [seeded, setSeeded] = useState(false)

  const monthStart = useMemo(() => startOfMonth(monthDate), [monthDate])
  const monthEnd = useMemo(() => endOfMonth(monthDate), [monthDate])
  const { events, loading, error, refresh } = useEvents(monthStart, monthEnd)

  // Seed demo events on first load if the calendar is empty.
  // We defer to next frame and use a ref so we never synchronously call
  // setState inside the effect body (react-hooks/set-state-in-effect rule).
  useEffect(() => {
    if (seeded || loading || events.length > 0) return
    let cancelled = false
    const id = requestAnimationFrame(async () => {
      if (cancelled) return
      try {
        await fetch('/api/seed', { method: 'POST' })
        if (!cancelled) {
          setSeeded(true)
          refresh()
        }
      } catch {
        if (!cancelled) setSeeded(true)
      }
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(id)
    }
  }, [seeded, loading, events.length, refresh])

  // Mark seeded when we already have events on first load
  useEffect(() => {
    if (!seeded && events.length > 0) {
      const id = requestAnimationFrame(() => setSeeded(true))
      return () => cancelAnimationFrame(id)
    }
  }, [seeded, events.length])

  const selectedDayEvents = useMemo(() => {
    return events
      .filter((e) => {
        const start = new Date(e.startAt)
        const end = new Date(e.endAt)
        const dayStart = new Date(
          selectedDate.getFullYear(),
          selectedDate.getMonth(),
          selectedDate.getDate(),
        )
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)
        return start < dayEnd && end > dayStart
      })
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
  }, [events, selectedDate])

  const handleSelectDate = useCallback((d: Date) => {
    setSelectedDate(d)
  }, [])

  const handleNewEvent = useCallback(() => {
    setEditingEvent(null)
    setDialogOpen(true)
  }, [])

  const handleEditEvent = useCallback((e: CalendarEvent) => {
    setEditingEvent(e)
    setDialogOpen(true)
  }, [])

  const handleSubmitEvent = useCallback(
    async (values: EventFormValues) => {
      if (editingEvent) {
        await updateEvent(editingEvent.id, values)
        toast.success('Event updated')
      } else {
        await createEvent(values)
        toast.success('Event created')
      }
      refresh()
    },
    [editingEvent, refresh],
  )

  const handleDeleteEvent = useCallback(
    async (eventOrId: CalendarEvent | string) => {
      const id = typeof eventOrId === 'string' ? eventOrId : eventOrId.id
      const title = typeof eventOrId === 'string' ? undefined : eventOrId.title
      await deleteEvent(id)
      toast.success(title ? `Deleted "${title}"` : 'Event deleted')
      refresh()
    },
    [refresh],
  )

  const handleBookedFromAI = useCallback(() => {
    refresh()
    toast.success('Event booked from AI assistant')
  }, [refresh])

  const goToday = () => {
    const t = new Date()
    setMonthDate(t)
    setSelectedDate(t)
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <h1 className="text-base font-semibold">Cadence</h1>
              <p className="text-xs text-muted-foreground">AI Calendar Assistant</p>
            </div>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-md border p-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setMonthDate((d) => subMonths(d, 1))}
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-[120px] text-center text-sm font-medium">
                {format(monthDate, 'MMMM yyyy')}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setMonthDate((d) => addMonths(d, 1))}
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={goToday}>
              Today
            </Button>
            <Button size="sm" onClick={handleNewEvent}>
              <Plus className="h-4 w-4" />
              New event
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={() => setSettingsOpen(true)}
              aria-label="Email settings"
              title="Email settings"
            >
              <Settings className="h-4 w-4" />
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
          <section className="space-y-4">
            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
            <MonthCalendar
              monthDate={monthDate}
              events={events}
              selectedDate={selectedDate}
              onSelectDate={handleSelectDate}
            />

            <SelectedDayList
              date={selectedDate}
              events={selectedDayEvents}
              onEdit={handleEditEvent}
              onNew={handleNewEvent}
              onDelete={handleDeleteEvent}
            />
          </section>

          <aside className="space-y-4">
            <AIAssistant onBooked={handleBookedFromAI} onOpenSettings={() => setSettingsOpen(true)} />
            <ReminderPanel onRemindersChanged={refresh} />
            <PwaInstallCard />
          </aside>
        </div>
      </main>

      <footer className="mt-auto border-t bg-muted/20">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs text-muted-foreground sm:px-6">
          <span>
            <Sparkles className="mr-1 inline h-3 w-3" />
            Cadence — built with Next.js, Prisma &amp; the Z.ai SDK
          </span>
          <span>Your calendar data is stored locally on this device.</span>
        </div>
      </footer>

      <EventFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialDate={selectedDate ?? undefined}
        event={editingEvent}
        onSubmit={handleSubmitEvent}
        onDelete={handleDeleteEvent}
      />

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  )
}

function SelectedDayList({
  date,
  events,
  onEdit,
  onNew,
  onDelete,
}: {
  date: Date
  events: CalendarEvent[]
  onEdit: (e: CalendarEvent) => void
  onNew: () => void
  onDelete: (e: CalendarEvent) => void
}) {
  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">{format(date, 'EEEE, MMMM d')}</h3>
            <p className="text-xs text-muted-foreground">
              {events.length === 0
                ? 'Nothing scheduled.'
                : `${events.length} ${events.length === 1 ? 'event' : 'events'} · click an event to edit, trash icon to delete`}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={onNew}>
            <Plus className="h-3.5 w-3.5" />
            Add
          </Button>
        </div>

        <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
          {events.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-1 rounded-md border border-dashed py-6 text-center">
              <p className="text-sm text-muted-foreground">Free all day.</p>
              <Button size="sm" variant="ghost" onClick={onNew}>
                Add an event
              </Button>
            </div>
          )}
          {events.map((e) => (
            <DayEventRow
              key={e.id}
              event={e}
              onClick={() => onEdit(e)}
              onDelete={() => onDelete(e)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function DayEventRow({
  event,
  onClick,
  onDelete,
}: {
  event: CalendarEvent
  onClick: () => void
  onDelete: () => void
}) {
  const color = (event.color as EventColor) ?? 'emerald'
  const styles = COLOR_STYLES[color] ?? COLOR_STYLES.emerald
  const start = new Date(event.startAt)
  const end = new Date(event.endAt)
  return (
    <motion.div
      whileHover={{ x: 2 }}
      className={cn(
        'group flex w-full items-center gap-3 rounded-md border bg-card px-3 py-2 text-left transition-colors hover:bg-accent/40',
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
        aria-label={`Edit ${event.title}`}
      >
        <span className={cn('h-9 w-1 shrink-0 rounded-full', styles.dot)} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{event.title}</p>
          <p className="text-xs text-muted-foreground">
            {event.allDay
              ? 'All day'
              : `${format(start, 'HH:mm')} – ${format(end, 'HH:mm')}`}
            {event.location && ` · ${event.location}`}
          </p>
        </div>
        <span className="hidden shrink-0 text-[10px] text-muted-foreground sm:inline">
          {event.reminderMinutes > 0
            ? event.reminderMinutes >= 60
              ? `${event.reminderMinutes / 60}h reminder`
              : `${event.reminderMinutes}m reminder`
            : 'no reminder'}
        </span>
      </button>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground opacity-60 transition-opacity hover:bg-destructive/10 hover:text-destructive hover:opacity-100 focus-visible:opacity-100 group-hover:opacity-100"
            aria-label={`Delete ${event.title}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this event?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="block font-medium text-foreground">{event.title}</span>
              <span className="block">
                {event.allDay
                  ? 'All day'
                  : `${format(start, 'EEE, MMM d · HH:mm')} – ${format(end, 'HH:mm')}`}
              </span>
              <span className="mt-2 block">
                This will also cancel its reminder. This action cannot be undone.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDelete}
              className="border border-rose-200 bg-rose-100 text-rose-700 hover:bg-rose-200 hover:text-rose-800 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-200 dark:hover:bg-rose-900/50"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  )
}
