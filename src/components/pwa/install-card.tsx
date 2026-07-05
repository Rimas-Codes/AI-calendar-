'use client'

import { useState } from 'react'
import { Download, Bell, BellOff, Smartphone, X, Zap, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { usePwaInstallPrompt } from '@/hooks/use-pwa-install'
import { usePushSubscription } from '@/hooks/use-push-subscription'
import { cn } from '@/lib/utils'

/**
 * A card that shows PWA install + push-notification subscription controls.
 * Appears in the right sidebar below the reminder panel.
 *
 * On desktop Chrome/Edge: "Install app" puts an icon on the desktop and opens
 * the app in its own window.
 * On Android Chrome: "Install app" adds it to the home screen as a native-feeling
 * app. Once push is enabled, reminders fire as system notifications even when
 * the app is in the background.
 */
export function PwaInstallCard() {
  const { canInstall, installed, promptInstall } = usePwaInstallPrompt()
  const { supported, permission, subscribed, requestPermission, subscribe, sendTest } =
    usePushSubscription()
  const [installing, setInstalling] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null
  if (installed && subscribed) return null
  if (!supported && installed) return null

  const handleInstall = async () => {
    setInstalling(true)
    await promptInstall()
    setInstalling(false)
  }

  const handleEnablePush = async () => {
    const p = await requestPermission()
    if (p === 'granted') {
      await subscribe()
    }
  }

  const handleTestPush = async () => {
    setTestResult(null)
    const result = await sendTest()
    setTestResult(result)
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Smartphone className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-semibold leading-tight">Install app &amp; mobile notifications</h2>
            <p className="text-xs text-muted-foreground">
              Install Cadence as an app on your desktop or Android phone for a native experience.
            </p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 shrink-0"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Install button */}
        {!installed && canInstall && (
          <Button onClick={handleInstall} disabled={installing} size="sm" className="w-full">
            <Download className="h-4 w-4" />
            {installing ? 'Installing…' : 'Install app'}
          </Button>
        )}
        {!installed && !canInstall && (
          <div className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            {supported
              ? 'Use your browser menu → "Install app" / "Add to Home screen" to install.'
              : 'This browser does not support app installation. Try Chrome or Edge.'}
          </div>
        )}
        {installed && (
          <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
            <CheckCircle2 className="h-3.5 w-3.5" />
            App installed — opens in its own window.
          </div>
        )}

        {/* Push notifications */}
        <div className="space-y-2 border-t pt-3">
          <div className="flex items-center gap-2">
            {subscribed ? (
              <Bell className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <BellOff className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            <span className="text-xs font-medium">
              {subscribed
                ? 'Push notifications enabled'
                : 'Enable push for background notifications'}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {subscribed
              ? 'Reminders will fire as system notifications even when the app is in the background (browser must be running).'
              : 'Push lets reminders reach your phone/desktop as native notifications even when the app is in the background. Requires notification permission.'}
          </p>

          {!subscribed && (
            <Button
              onClick={handleEnablePush}
              disabled={!supported || permission === 'denied'}
              size="sm"
              variant="outline"
              className="w-full"
            >
              <Bell className="h-3.5 w-3.5" />
              {permission === 'denied' ? 'Notifications blocked' : 'Enable push notifications'}
            </Button>
          )}

          {permission === 'denied' && (
            <p className="text-[10px] text-amber-700 dark:text-amber-400">
              Notification permission was blocked. Reset it in your browser site settings to enable.
            </p>
          )}

          {subscribed && (
            <Button onClick={handleTestPush} size="sm" variant="outline" className="w-full">
              <Zap className="h-3.5 w-3.5" />
              Send test push
            </Button>
          )}

          {testResult && (
            <div
              className={cn(
                'rounded px-2 py-1.5 text-[11px]',
                testResult.ok
                  ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
                  : 'bg-destructive/10 text-destructive',
              )}
            >
              {testResult.ok ? '✓ ' : '✗ '}
              {testResult.message}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
