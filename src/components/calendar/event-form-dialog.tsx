'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { COLOR_OPTIONS, type CalendarEvent, type EventColor } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Mail } from 'lucide-react'

interface EventFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialDate?: Date
  /** When provided, the dialog edits this event; otherwise it creates a new one. */
  event?: CalendarEvent | null
  onSubmit: (input: EventFormValues) => Promise<void>
  onDelete?: (id: string) => Promise<void>
}

export interface EventFormValues {
  title: string
  description: string | null
  location: string | null
  startAt: string
  endAt: string
  allDay: boolean
  color: EventColor
  reminderMinutes: number
  emailRecipient: string | null
}

function toLocalInput(d: Date): string {
  // yyyy-MM-ddTHH:mm
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function EventFormDialog({
  open,
  onOpenChange,
  initialDate,
  event,
  onSubmit,
  onDelete,
}: EventFormDialogProps) {
  const isEdit = !!event

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [startAt, setStartAt] = useState('')
  const [endAt, setEndAt] = useState('')
  const [allDay, setAllDay] = useState(false)
  const [color, setColor] = useState<EventColor>('emerald')
  const [reminderMinutes, setReminderMinutes] = useState<number>(15)
  const [emailRecipient, setEmailRecipient] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const id = requestAnimationFrame(() => {
      if (cancelled) return
      if (event) {
        setTitle(event.title)
        setDescription(event.description ?? '')
        setLocation(event.location ?? '')
        setStartAt(toLocalInput(new Date(event.startAt)))
        setEndAt(toLocalInput(new Date(event.endAt)))
        setAllDay(event.allDay)
        setColor((event.color as EventColor) ?? 'emerald')
        setReminderMinutes(event.reminderMinutes)
        setEmailRecipient(event.emailRecipient ?? '')
      } else {
        const base = initialDate ?? new Date()
        const start = new Date(base)
        start.setHours(start.getHours() + 1, 0, 0, 0)
        const end = new Date(start.getTime() + 60 * 60 * 1000)
        setTitle('')
        setDescription('')
        setLocation('')
        setStartAt(toLocalInput(start))
        setEndAt(toLocalInput(end))
        setAllDay(false)
        setColor('emerald')
        setReminderMinutes(15)
        setEmailRecipient('')
      }
      setError(null)
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(id)
    }
  }, [open, event, initialDate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!title.trim()) {
      setError('Title is required.')
      return
    }
    const start = new Date(startAt)
    const end = new Date(endAt)
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      setError('Start and end times must be valid.')
      return
    }
    if (end <= start) {
      setError('End time must be after start time.')
      return
    }
    setSaving(true)
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim() || null,
        location: location.trim() || null,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        allDay,
        color,
        reminderMinutes,
        emailRecipient: emailRecipient.trim() || null,
      })
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!event || !onDelete) return
    setDeleting(true)
    try {
      await onDelete(event.id)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit event' : 'New event'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update the event details. Reminder will be rescheduled.'
              : 'Add an event to your calendar. A reminder will fire before it starts.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Dentist appointment"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="start">Starts</Label>
              <Input
                id="start"
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end">Ends</Label>
              <Input
                id="end"
                type="datetime-local"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reminder">Reminder</Label>
              <Select
                value={String(reminderMinutes)}
                onValueChange={(v) => setReminderMinutes(Number(v))}
              >
                <SelectTrigger id="reminder">
                  <SelectValue placeholder="When to remind you" />
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

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional notes, agenda, links…"
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email" className="flex items-center gap-1">
              <Mail className="h-3.5 w-3.5" />
              Email reminder (optional)
            </Label>
            <Input
              id="email"
              type="email"
              inputMode="email"
              value={emailRecipient}
              onChange={(e) => setEmailRecipient(e.target.value)}
              placeholder="you@example.com"
            />
            <p className="text-xs text-muted-foreground">
              If set, a reminder email will be sent to this address the day before the event. (Demo
              sends via Ethereal test SMTP — emails are previewed, not delivered to a real inbox.)
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Label htmlFor="allDay" className="text-sm">
              All-day event
            </Label>
            <Switch id="allDay" checked={allDay} onCheckedChange={setAllDay} />
          </div>

          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Color ${c}`}
                  onClick={() => setColor(c)}
                  className={cn(
                    'h-7 w-7 rounded-full border-2 transition-transform',
                    c === 'emerald' && 'bg-emerald-500',
                    c === 'amber' && 'bg-amber-500',
                    c === 'rose' && 'bg-rose-500',
                    c === 'violet' && 'bg-violet-500',
                    c === 'cyan' && 'bg-cyan-500',
                    c === 'slate' && 'bg-slate-500',
                    color === c
                      ? 'border-foreground scale-110'
                      : 'border-transparent hover:scale-105',
                  )}
                />
              ))}
            </div>
          </div>

          {error && (
            <p className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter className="gap-2">
            {isEdit && onDelete && (
              <Button
                type="button"
                variant="ghost"
                onClick={handleDelete}
                disabled={deleting || saving}
                className="mr-auto text-destructive hover:bg-destructive/10"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create event'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
