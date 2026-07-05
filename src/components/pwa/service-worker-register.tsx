'use client'

import { useEffect } from 'react'

/**
 * Registers the service worker for PWA install + push notifications.
 * Rendered as a React component (not a <script> tag) to avoid the
 * "Scripts inside React components are never executed" warning.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
    const id = requestAnimationFrame(() => {
      navigator.serviceWorker.register('/sw.js').catch((e) => {
        console.warn('SW registration failed:', e)
      })
    })
    return () => cancelAnimationFrame(id)
  }, [])

  return null
}
