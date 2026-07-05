'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Mail, MailCheck, Trash2, Zap } from 'lucide-react'
import { SMTP_PRESETS } from '@/lib/smtp-settings'
import type { SmtpSettings as SmtpSettingsType } from '@/lib/smtp-settings'

interface MaskedSettings extends SmtpSettingsType {
  hasPassword: boolean
}

interface SmtpSettingsSectionProps {
  onChanged?: () => void
}

export function SmtpSettingsSection({ onChanged }: SmtpSettingsSectionProps) {
  const [settings, setSettings] = useState<MaskedSettings | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testTo, setTestTo] = useState('')
  const [testResult, setTestResult] = useState<
    { ok: boolean; message: string; messageId?: string } | null
  >(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const id = requestAnimationFrame(() => {
      if (cancelled) return
      setLoading(true)
      setError(null)
      setTestResult(null)
      fetch('/api/settings/smtp', { cache: 'no-store' })
        .then((r) => r.json())
        .then((data) => {
          if (!cancelled) setSettings(data.settings as MaskedSettings)
        })
        .catch((e) => {
          if (!cancelled) setError(e instanceof Error ? e.message : String(e))
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(id)
    }
  }, [])

  const applyPreset = (presetId: string) => {
    if (!settings) return
    const preset = SMTP_PRESETS.find((p) => p.id === presetId)
    if (!preset) return
    setSettings({
      ...settings,
      provider: preset.id,
      host: preset.host,
      port: preset.port,
      secure: preset.secure,
    })
  }

  const handleSave = async () => {
    if (!settings) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/settings/smtp', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `Failed (${res.status})`)
      }
      const data = await res.json()
      setSettings(data.settings as MaskedSettings)
      onChanged?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const handleClear = async () => {
    setSaving(true)
    setError(null)
    try {
      await fetch('/api/settings/smtp', { method: 'DELETE' })
      const res = await fetch('/api/settings/smtp', { cache: 'no-store' })
      const data = await res.json()
      setSettings(data.settings as MaskedSettings)
      onChanged?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    if (!settings || !testTo.trim()) return
    setTesting(true)
    setError(null)
    setTestResult(null)
    try {
      const res = await fetch('/api/settings/smtp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: testTo.trim(), settings }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || `Failed (${res.status})`)
      }
      setTestResult({
        ok: true,
        message: `Test email sent to ${testTo} from ${data.from} via ${data.via}. Check the inbox (and spam folder on first send).`,
        messageId: data.messageId,
      })
    } catch (e) {
      setTestResult({
        ok: false,
        message: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setTesting(false)
    }
  }

  const preset = SMTP_PRESETS.find((p) => p.id === settings?.provider)
  const isActive =
    settings?.enabled && settings?.hasPassword && !!settings?.host && !!settings?.fromEmail

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (!settings) {
    return <p className="text-sm text-muted-foreground">Could not load SMTP settings.</p>
  }

  return (
    <div className="space-y-4">
      {/* Status badge */}
      <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
        {isActive ? (
          <>
            <MailCheck className="h-4 w-4 text-emerald-600" />
            <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">SMTP active</span>
            <span className="text-xs text-muted-foreground">
              — via {settings.host}:{settings.port} from {settings.fromEmail}
            </span>
          </>
        ) : (
          <>
            <Mail className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-700 dark:text-amber-400">Ethereal fallback</span>
            <span className="text-xs text-muted-foreground">— preview only, not delivered to real inboxes</span>
          </>
        )}
      </div>

      {/* Enable toggle */}
      <div className="flex items-center justify-between gap-3 rounded-md border p-3">
        <div>
          <Label htmlFor="smtp-enabled" className="text-sm font-medium">Enable custom SMTP</Label>
          <p className="text-xs text-muted-foreground">Turn on to send real emails. Off = Ethereal preview fallback.</p>
        </div>
        <Switch
          id="smtp-enabled"
          checked={settings.enabled}
          onCheckedChange={(v) => setSettings({ ...settings, enabled: v })}
        />
      </div>

      {/* Provider preset */}
      <div className="space-y-1.5">
        <Label htmlFor="provider">Provider</Label>
        <Select value={settings.provider || 'custom'} onValueChange={applyPreset}>
          <SelectTrigger id="provider"><SelectValue placeholder="Choose a provider" /></SelectTrigger>
          <SelectContent>
            {SMTP_PRESETS.map((p) => (<SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>))}
          </SelectContent>
        </Select>
        {preset && preset.hint && <p className="text-xs text-muted-foreground">{preset.hint}</p>}
      </div>

      {/* Host + Port */}
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="host">SMTP host</Label>
          <Input id="host" value={settings.host} onChange={(e) => setSettings({ ...settings, host: e.target.value })} placeholder="smtp.gmail.com" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="port">Port</Label>
          <Input id="port" type="number" value={settings.port} onChange={(e) => setSettings({ ...settings, port: Number(e.target.value) || 0 })} placeholder="587" />
        </div>
      </div>

      {/* Secure toggle */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <Label htmlFor="secure" className="text-sm">Use TLS (port 465)</Label>
          <p className="text-xs text-muted-foreground">On = implicit TLS. Off = STARTTLS (587/25).</p>
        </div>
        <Switch id="secure" checked={settings.secure} onCheckedChange={(v) => setSettings({ ...settings, secure: v })} />
      </div>

      {/* Username + Password */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="user">{preset?.usernameLabel ?? 'Username'}</Label>
          <Input
            id="user"
            value={settings.user}
            onChange={(e) => {
              const newUser = e.target.value
              if (preset?.usernameIsEmail) {
                setSettings({ ...settings, user: newUser, fromEmail: newUser })
              } else {
                setSettings({ ...settings, user: newUser })
              }
            }}
            placeholder={preset?.usernamePlaceholder ?? 'SMTP username'}
            autoComplete="off"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">
            {preset?.id === 'sendgrid' || preset?.id === 'resend' ? 'API key' : 'Password'}{' '}
            {settings.hasPassword && <span className="text-xs text-muted-foreground">(saved — leave as is to keep)</span>}
          </Label>
          <Input
            id="password"
            type="password"
            value={settings.password}
            onChange={(e) => setSettings({ ...settings, password: e.target.value })}
            placeholder={settings.hasPassword ? '••••••••' : preset?.passwordPlaceholder ?? 'Your password or API key'}
            autoComplete="off"
          />
        </div>
      </div>

      {/* From name + email */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="fromName">From name</Label>
          <Input id="fromName" value={settings.fromName} onChange={(e) => setSettings({ ...settings, fromName: e.target.value })} placeholder="Cadence" />
        </div>
        {preset?.usernameIsEmail ? (
          <div className="space-y-1.5">
            <Label htmlFor="fromEmail" className="text-muted-foreground">From email</Label>
            <div className="flex h-9 items-center rounded-md border border-dashed bg-muted/30 px-3 text-xs text-muted-foreground">
              {settings.fromEmail || settings.user || '—'} <span className="ml-1 italic">(same as your email)</span>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="fromEmail">From email</Label>
            <Input id="fromEmail" type="email" value={settings.fromEmail} onChange={(e) => setSettings({ ...settings, fromEmail: e.target.value })} placeholder="verified-sender@yourdomain.com" />
            <p className="text-[10px] text-muted-foreground">Must be a verified sender on your {preset?.label ?? 'provider'} account.</p>
          </div>
        )}
      </div>

      {/* Test section */}
      <div className="rounded-md border bg-muted/20 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Test your settings</span>
        </div>
        <p className="text-xs text-muted-foreground">Send a test email to verify your credentials work before saving.</p>
        <div className="flex gap-2">
          <Input type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="recipient@example.com" className="text-sm" />
          <Button size="sm" variant="outline" onClick={handleTest} disabled={testing || !testTo.trim()}>
            {testing ? (<><Loader2 className="h-3.5 w-3.5 animate-spin" />Sending…</>) : (<><Zap className="h-3.5 w-3.5" />Send test</>)}
          </Button>
        </div>
        {testResult && (
          <div className={`rounded px-3 py-2 text-xs ${testResult.ok ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' : 'bg-destructive/10 text-destructive'}`}>
            {testResult.ok ? '✓ ' : '✗ '}{testResult.message}
          </div>
        )}
      </div>

      {error && <p className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={handleClear} disabled={saving} className="text-destructive hover:bg-destructive/10">
          <Trash2 className="h-4 w-4" />Clear
        </Button>
        <Button type="button" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save SMTP settings'}
        </Button>
      </div>
    </div>
  )
}
