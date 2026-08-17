'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * Cooking timers that survive a reload and a backgrounded tab.
 *
 * Timers store an absolute end timestamp rather than a countdown, so elapsed
 * time is derived from the clock instead of from how often an interval managed
 * to fire. A phone that slept for twenty minutes therefore comes back with the
 * correct remaining time rather than twenty minutes behind.
 */

export interface CookTimer {
  id: string
  label: string
  /** Epoch ms when the timer should finish. */
  endsAt: number
  /** Set while paused; the countdown resumes from here. */
  remainingMs: number | null
  totalMs: number
}

export interface CookProgress {
  recipeId: string
  startedAt: string
  currentStep: number
  completedStepIds: string[]
  timers: CookTimer[]
}

const STORAGE_PREFIX = 'impasto:cook:'

export function storageKeyFor(recipeId: string): string {
  return `${STORAGE_PREFIX}${recipeId}`
}

export function loadProgress(recipeId: string): CookProgress | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(storageKeyFor(recipeId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as CookProgress
    // Reject anything that is not shaped like progress rather than trusting it.
    if (!parsed || typeof parsed !== 'object' || parsed.recipeId !== recipeId) return null
    return {
      recipeId,
      startedAt: typeof parsed.startedAt === 'string' ? parsed.startedAt : new Date().toISOString(),
      currentStep: Number.isInteger(parsed.currentStep) ? parsed.currentStep : 0,
      completedStepIds: Array.isArray(parsed.completedStepIds) ? parsed.completedStepIds : [],
      timers: Array.isArray(parsed.timers) ? parsed.timers : [],
    }
  } catch {
    return null
  }
}

export function saveProgress(progress: CookProgress): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(storageKeyFor(progress.recipeId), JSON.stringify(progress))
  } catch {
    // Storage full or blocked; cooking must continue regardless.
  }
}

export function clearProgress(recipeId: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(storageKeyFor(recipeId))
  } catch {
    /* Nothing to do. */
  }
}

export function remainingMs(timer: CookTimer, now: number): number {
  if (timer.remainingMs !== null) return timer.remainingMs
  return Math.max(0, timer.endsAt - now)
}

export function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const pad = (value: number) => String(value).padStart(2, '0')
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${minutes}:${pad(seconds)}`
}

/** Ticks once a second purely to re-render; the truth is the wall clock. */
export function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!active) return
    const handle = setInterval(() => setNow(Date.now()), 1000)
    // Re-sync immediately when the tab comes back rather than waiting a tick.
    const onVisible = () => setNow(Date.now())
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(handle)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [active])

  return now
}

/**
 * Timer operations over a caller-owned list.
 *
 * Deliberately stateless: the timers live in the restored cook progress, which
 * arrives from local storage in an effect *after* the first render. Holding a
 * copy in `useState` here would seed it with an empty list and silently drop
 * every timer on reload.
 */
export function useTimers(timers: CookTimer[], onChange: (timers: CookTimer[]) => void) {
  const update = useCallback((next: CookTimer[]) => onChange(next), [onChange])

  const add = useCallback(
    (label: string, minutes: number) => {
      const totalMs = Math.round(minutes * 60_000)
      update([
        ...timers,
        {
          id: `timer-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          label,
          endsAt: Date.now() + totalMs,
          remainingMs: null,
          totalMs,
        },
      ])
    },
    [timers, update],
  )

  const pause = useCallback(
    (id: string) => {
      update(
        timers.map((timer) =>
          timer.id === id && timer.remainingMs === null
            ? { ...timer, remainingMs: Math.max(0, timer.endsAt - Date.now()) }
            : timer,
        ),
      )
    },
    [timers, update],
  )

  const resume = useCallback(
    (id: string) => {
      update(
        timers.map((timer) =>
          timer.id === id && timer.remainingMs !== null
            ? { ...timer, endsAt: Date.now() + timer.remainingMs, remainingMs: null }
            : timer,
        ),
      )
    },
    [timers, update],
  )

  const remove = useCallback(
    (id: string) => update(timers.filter((timer) => timer.id !== id)),
    [timers, update],
  )

  return { add, pause, resume, remove }
}
