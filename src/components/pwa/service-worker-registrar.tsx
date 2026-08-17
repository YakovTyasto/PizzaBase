'use client'

import { useEffect } from 'react'

/**
 * Registers the service worker after the page has settled, so caching work
 * never competes with the first paint. Registration failures are deliberately
 * swallowed: an unavailable service worker must not break the app.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    if (process.env.NODE_ENV !== 'production') return

    const register = () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
        /* Offline support is a progressive enhancement. */
      })
    }

    if (document.readyState === 'complete') register()
    else window.addEventListener('load', register, { once: true })
  }, [])

  return null
}
