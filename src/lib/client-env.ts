'use client'

import { useSyncExternalStore } from 'react'

/**
 * Reading browser-only facts without a state-setting effect.
 *
 * `useSyncExternalStore` is the right tool here: it returns the server snapshot
 * during SSR and hydration, then the real one, so there is no hydration
 * mismatch and no cascading render from a `setState` inside `useEffect`.
 */

/** Nothing to subscribe to: these values never change after load. */
const neverChanges = () => () => {}

const alwaysTrue = () => true
const alwaysFalse = () => false

/** False during SSR and hydration, true once running in the browser. */
export function useHydrated(): boolean {
  return useSyncExternalStore(neverChanges, alwaysTrue, alwaysFalse)
}

const hasWakeLock = () => typeof navigator !== 'undefined' && 'wakeLock' in navigator
const hasBarcodeDetector = () => typeof window !== 'undefined' && 'BarcodeDetector' in window

export function useWakeLockSupported(): boolean {
  return useSyncExternalStore(neverChanges, hasWakeLock, alwaysFalse)
}

export function useBarcodeDetectorSupported(): boolean {
  return useSyncExternalStore(neverChanges, hasBarcodeDetector, alwaysFalse)
}

/** Online status, which genuinely does change and so has a real subscription. */
function subscribeToConnectivity(onChange: () => void) {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

const readOffline = () => typeof navigator !== 'undefined' && !navigator.onLine

export function useOffline(): boolean {
  // Optimistic on the server: flashing "offline" on first paint would be worse
  // than a moment of silence.
  return useSyncExternalStore(subscribeToConnectivity, readOffline, alwaysFalse)
}
