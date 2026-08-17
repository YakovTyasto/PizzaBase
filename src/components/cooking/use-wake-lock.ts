'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Keeps the screen awake while cooking.
 *
 * The lock is dropped by the browser whenever the tab is hidden, so it is
 * re-acquired on `visibilitychange` -- otherwise the screen would go dark the
 * first time the cook checks a message. When the API is missing the hook
 * reports `supported: false` so the UI can tell the user to change their
 * auto-lock setting instead of silently doing nothing.
 */
export function useWakeLock() {
  const [enabled, setEnabled] = useState(false)
  const [supported, setSupported] = useState(true)
  const sentinel = useRef<WakeLockSentinel | null>(null)

  useEffect(() => {
    setSupported(typeof navigator !== 'undefined' && 'wakeLock' in navigator)
  }, [])

  const acquire = useCallback(async () => {
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return false
    try {
      sentinel.current = await navigator.wakeLock.request('screen')
      return true
    } catch {
      // Denied, or the document is not visible. Not fatal.
      return false
    }
  }, [])

  const release = useCallback(async () => {
    try {
      await sentinel.current?.release()
    } catch {
      /* Already released. */
    }
    sentinel.current = null
  }, [])

  useEffect(() => {
    if (!enabled) {
      void release()
      return
    }

    void acquire()

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && enabled) void acquire()
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      void release()
    }
  }, [enabled, acquire, release])

  return { enabled, setEnabled, supported }
}
