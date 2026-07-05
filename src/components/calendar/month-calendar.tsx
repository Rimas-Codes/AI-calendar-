'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import type { CalendarEvent, EventColor } from '@/lib/types'
import { COLOR_STYLES } from '@/lib/types'

interface MonthCalendarProps {
  monthDate: Date
  events: CalendarEvent[]
  selectedDate: Date | null
  onSelectDate: (date: Date) => void
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function MonthCalendar({
  monthDate,
  events,
  selectedDate,
  onSelectDate,
}: MonthCalendarProps) {
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(monthDate), { weekStartsOn: 1 })
    const end = endOfWeek(endOfMonth(monthDate), { weekStartsOn: 1 })
    const out: Date[] = []
    let d = start
    while (d <= end) {
      out.push(d)
      d = addDays(d, 1)
    }
    return out
  }, [monthDate])

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const e of events) {
      const start = new Date(e.startAt)
      const end = new Date(e.endAt)
      // For multi-day events, list them on each day they touch
      let d = new Date(start.getFullYear(), start.getMonth(), start.getDate())
      const last = new Date(end.getFullYear(), end.getMonth(), end.getDate())
      while (d <= last) {
        const key = format(d, 'yyyy-MM-dd')
        const arr = map.get(key) ?? []
        arr.push(e)
        map.set(key, arr)
        d = addDays(d, 1)
      }
    }
    return map
  }, [events])

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
      <div className="grid grid-cols-7 border-b bg-muted/30">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="py-2 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground"
          >
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 grid-rows-6">
        {days.map((day, i) => {
          const inMonth = isSameMonth(day, monthDate)
          const today = isToday(day)
          const selected = selectedDate && isSameDay(day, selectedDate)
          const dayEvents = eventsByDay.get(format(day, 'yyyy-MM-dd')) ?? []
          const maxShow = 2
          const shown = dayEvents.slice(0, maxShow)
          const extra = dayEvents.length - shown.length

          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelectDate(day)}
              className={cn(
                'relative flex min-h-[96px] flex-col gap-1 border-b border-r p-1.5 text-left transition-colors sm:min-h-[120px] sm:p-2',
                'hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                !inMonth && 'bg-muted/20 text-muted-foreground',
                (i + 1) % 7 === 0 && 'border-r-0',
                i >= days.length - 7 && 'border-b-0',
                selected && 'bg-accent/60 ring-1 ring-inset ring-primary/40',
              )}
            >
              <span
                className={cn(
                  'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                  today && 'bg-primary text-primary-foreground',
                  !today && inMonth && 'text-foreground',
                  !today && !inMonth && 'text-muted-foreground',
                )}
              >
                {format(day, 'd')}
              </span>
              <div className="flex flex-col gap-0.5 overflow-hidden">
                {shown.map((e) => (
                  <EventChip key={e.id} event={e} />
                ))}
                {extra > 0 && (
                  <span className="px-1 text-[10px] font-medium text-muted-foreground sm:text-xs">
                    +{extra} more
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function EventChip({ event }: { event: CalendarEvent }) {
  const color = (event.color as EventColor) ?? 'emerald'
  const styles = COLOR_STYLES[color] ?? COLOR_STYLES.emerald
  const time = format(new Date(event.startAt), 'HH:mm')
  return (
    <div
      className={cn(
        'flex items-center gap-1 truncate rounded border px-1 py-0.5 text-[10px] font-medium leading-tight sm:text-xs',
        styles.chip,
      )}
      title={`${event.title} · ${time}`}
    >
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', styles.dot)} />
      <span className="truncate">{event.allDay ? event.title : `${time} ${event.title}`}</span>
    </div>
  )
}
