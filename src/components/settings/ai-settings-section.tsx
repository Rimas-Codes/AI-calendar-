'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Sparkles, Trash2, Zap, ExternalLink } from 'lucide-react'
import { AI_PRESETS, getPreset } from '@/lib/ai-settings'
import type { AiSettings as AiSettingsType } from '@/lib/ai-settings'

interface MaskedAiSettings extends AiSettingsType {
  hasApiKey: boolean
}

interface AiSettingsSectionProps {
  onChanged?: () => void
}

/**
 * Safely parse a fetch response as JSON. If the response is HTML (e.g. a
 * Next.js error page from a crashed server), return a helpful error object
 * instead of throwing "Unexpected token '<'".
 */
async function safeJson(res: Response): Promise<any> {
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    // The response wasn't JSON — probably an HTML error page
    if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
      throw new Error(
        `Server returned an HTML error page instead of JSON (HTTP ${res.status}). ` +
        `The Next.js server may have crashed — check the terminal window running Cadence for errors.`
      )
    }
    throw new Error(`Server returned an unexpected response (HTTP ${res.status}): ${text.slice(0, 200)}`)
  }
}

export function AiSettingsSection({ onChanged }: AiSettingsSectionProps) {
  const [settings, setSettings] = useState<MaskedAiSettings | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showApiKey, setShowApiKey] = useState(false)

  useEffect(() => {
    let cancelled = false
    const id = requestAnimationFrame(() => {
      if (cancelled) return
      setLoading(true)
      setError(null)
      setTestResult(null)
      fetch('/api/settings/ai', { cache: 'no-store' })
        .then(async (r) => {
          const data = await safeJson(r)
          if (!cancelled) setSettings(data.settings as MaskedAiSettings)
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
    const preset = getPreset(presetId)
    setSettings({
      ...settings,
      provider: preset.id,
      model: preset.models.some((m) => m.id === settings.model)
        ? settings.model
        : preset.defaultModel,
      baseUrl: preset.baseUrl ?? '',
    })
  }

  const handleSave = async () => {
    if (!settings) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/settings/ai', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      const data = await safeJson(res)
      if (!res.ok) {
        throw new Error(data.error || `Failed (${res.status})`)
      }
      setSettings(data.settings as MaskedAiSettings)
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
      await fetch('/api/settings/ai', { method: 'DELETE' })
      const res = await fetch('/api/settings/ai', { cache: 'no-store' })
      const data = await safeJson(res)
      setSettings(data.settings as MaskedAiSettings)
      onChanged?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    if (!settings) return
    setTesting(true)
    setError(null)
    setTestResult(null)
    try {
      // Save first so the DB is in sync with what we're testing.
      const saveRes = await fetch('/api/settings/ai', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      const savedData = await safeJson(saveRes)
      if (!saveRes.ok) {
        throw new Error(`Failed to save before testing: ${savedData.error || saveRes.status}`)
      }
      setSettings(savedData.settings as MaskedAiSettings)
      onChanged?.()

      // Now test using the saved settings
      const res = await fetch('/api/settings/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: savedData.settings }),
      })
      const data = await safeJson(res)
      if (!res.ok) {
        throw new Error(data.error || `Failed (${res.status})`)
      }
      setTestResult({
        ok: true,
        message: `OK — ${data.provider} / ${data.model} responded with: "${data.response}". Settings saved.`,
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!settings) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Could not load AI settings.</p>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    )
  }

  const preset = getPreset(settings.provider)
  const tierColor =
    preset.tier === 'free'
      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
      : preset.tier === 'local'
        ? 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200'
        : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'

  return (
    <div className="space-y-4">
      {/* Status badge */}
      <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">{preset.label}</span>
        <Badge variant="outline" className={`text-[10px] ${tierColor}`}>
          {preset.tier}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {preset.requiresApiKey
            ? settings.hasApiKey
              ? `— API key saved, using model ${settings.model || preset.defaultModel}`
              : '— API key required (not set yet)'
            : `— no API key needed, using model ${settings.model || preset.defaultModel}`}
        </span>
      </div>

      {/* Provider dropdown */}
      <div className="space-y-1.5">
        <Label htmlFor="ai-provider">AI provider</Label>
        <Select value={settings.provider} onValueChange={applyPreset}>
          <SelectTrigger id="ai-provider">
            <SelectValue placeholder="Choose a provider" />
          </SelectTrigger>
          <SelectContent>
            {AI_PRESETS.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {preset.hint && <p className="text-xs text-muted-foreground">{preset.hint}</p>}
      </div>

      {/* Model dropdown */}
      <div className="space-y-1.5">
        <Label htmlFor="ai-model">Model</Label>
        <Select
          value={settings.model || preset.defaultModel}
          onValueChange={(v) => setSettings({ ...settings, model: v })}
        >
          <SelectTrigger id="ai-model">
            <SelectValue placeholder="Choose a model" />
          </SelectTrigger>
          <SelectContent>
            {preset.models.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* API key (conditional) */}
      {preset.requiresApiKey && (
        <div className="space-y-1.5">
          <Label htmlFor="ai-key" className="flex items-center justify-between">
            <span>API key</span>
            {preset.apiKeyUrl && (
              <a
                href={preset.apiKeyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary underline hover:text-primary/80 flex items-center gap-0.5"
              >
                Get a free key
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </Label>
          <div className="relative">
            <Input
              id="ai-key"
              type={showApiKey ? 'text' : 'password'}
              value={settings.apiKey}
              onChange={(e) => setSettings({ ...settings, apiKey: e.target.value.trim() })}
              placeholder={
                settings.hasApiKey ? '•••••••• (saved — leave as is to keep)' : 'Paste your API key here'
              }
              autoComplete="off"
              className="pr-20"
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
            >
              {showApiKey ? 'Hide' : 'Show'}
            </button>
          </div>
          {settings.hasApiKey && (
            <p className="text-[10px] text-muted-foreground">
              Key is saved locally on your machine. Click "Show" to verify what you typed.
            </p>
          )}
        </div>
      )}

      {/* Base URL override (only for ollama / openai) */}
      {(preset.id === 'ollama' || preset.id === 'openai') && (
        <div className="space-y-1.5">
          <Label htmlFor="ai-baseurl">Base URL</Label>
          <Input
            id="ai-baseurl"
            value={settings.baseUrl ?? ''}
            onChange={(e) => setSettings({ ...settings, baseUrl: e.target.value })}
            placeholder={preset.baseUrl ?? 'http://localhost:11434'}
          />
        </div>
      )}

      {/* Test section */}
      <div className="rounded-md border bg-muted/20 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Test AI connection</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Saves your settings and sends a tiny prompt to verify the AI provider works.
        </p>
        <Button size="sm" variant="outline" onClick={handleTest} disabled={testing}>
          {testing ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Testing…
            </>
          ) : (
            <>
              <Zap className="h-3.5 w-3.5" />
              Test &amp; save
            </>
          )}
        </Button>
        {testResult && (
          <div
            className={`rounded px-3 py-2 text-xs ${
              testResult.ok
                ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
                : 'bg-destructive/10 text-destructive'
            }`}
          >
            {testResult.ok ? '✓ ' : '✗ '}
            {testResult.message}
          </div>
        )}
      </div>

      {error && (
        <p className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="ghost"
          onClick={handleClear}
          disabled={saving}
          className="text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-4 w-4" />
          Reset
        </Button>
        <Button type="button" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save AI settings'}
        </Button>
      </div>
    </div>
  )
}
