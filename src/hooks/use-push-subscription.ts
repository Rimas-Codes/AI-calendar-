'use client'

import { useEffect, useState } from 'react'

/**
 * Subscribes the browser to web push notifications using the VAPID public key
 * from the server. The subscription is sent to /api/push/subscribe so the
 * server can send push messages to this device.
 *
 * Returns:
 *  - permission: the current Notification permission state
 *  - subscribed: whether this device is actively subscribed to push
 *  - supported: whether web push is supported in this browser
 *  - requestPermission: prompt the user for notification permission
 *  - subscribe: subscribe to push (requires permission first)
 *  - sendTest: trigger a test push from the server
 */
export function usePushSubscription() {
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [subscribed, setSubscribed] = useState(false)
  const [supported, setSupported] = useState(false)

  useEffect(() => {
    let cancelled = false
    const id = requestAnimationFrame(() => {
      if (cancelled) return
      if (
        typeof window === 'undefined' ||
        !('serviceWorker' in navigator) ||
        !('PushManager' in window)
      ) {
        setSupported(false)
        return
      }
      setSupported(true)
      setPermission(Notification.permission)

      // Check if already subscribed
      navigator.serviceWorker.ready
        .then((reg) => reg.pushManager.getSubscription())
        .then((sub) => {
          if (!cancelled) setSubscribed(!!sub)
        })
        .catch(() => {})
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(id)
    }
  }, [])

  const requestPermission = async (): Promise<NotificationPermission> => {
    if (!supported) return 'denied'
    const p = await Notification.requestPermission()
    setPermission(p)
    return p
  }

  const subscribe = async (): Promise<boolean> => {
    if (!supported) return false
    if (Notification.permission !== 'granted') {
      const p = await requestPermission()
      if (p !== 'granted') return false
    }
    try {
      const reg = await navigator.serviceWorker.ready
      // Fetch the VAPID public key from the server
      const res = await fetch('/api/push/vapid-public-key', { cache: 'no-store' })
      if (!res.ok) return false
      const { publicKey } = await res.json()
      if (!publicKey) return false

      // Convert the base64 public key to Uint8Array for the Push API
      const applicationServerKey = urlBase64ToUint8Array(publicKey)
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      })

      // Send the subscription to the server
      const subJson = sub.toJSON()
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          keys: subJson.keys,
        }),
      })
      setSubscribed(true)
      return true
    } catch (err) {
      console.error('Push subscription failed:', err)
      return false
    }
  }

  const sendTest = async (): Promise<{ ok: boolean; message: string }> => {
    try {
      const res = await fetch('/api/push/test', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        return { ok: false, message: data.error || `Failed (${res.status})` }
      }
      return {
        ok: true,
        message: `Test push sent to ${data.sent} device(s). You should see a notification shortly.`,
      }
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) }
    }
  }

  return {
    permission,
    subscribed,
    supported,
    requestPermission,
    subscribe,
    sendTest,
  }
}

/** Convert a base64url string to a Uint8Array (required by Push API). */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const output = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    output[i] = rawData.charCodeAt(i)
  }
  return output
}
