// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  type CookTimer,
  clearProgress,
  formatRemaining,
  loadProgress,
  remainingMs,
  saveProgress,
  storageKeyFor,
} from './timers'

/**
 * A timer must open at exactly what it was set for.
 *
 * `now` is a once-a-second snapshot, so a timer created between two ticks is
 * compared against a clock reading up to a second in the past. `endsAt - now`
 * then exceeds the configured duration, and the ceiling inside
 * `formatRemaining` rounds that up -- which is how a 20-minute timer opened
 * showing 20:01.
 */
function timerOf(totalMinutes: number, createdAt: number): CookTimer {
  const totalMs = totalMinutes * 60_000
  return {
    id: 'timer-1',
    label: 'Bulk',
    endsAt: createdAt + totalMs,
    remainingMs: null,
    totalMs,
  }
}

describe('a timer at the moment it starts', () => {
  it('never shows more than its configured duration', () => {
    const created = 1_000_000
    const timer = timerOf(20, created)

    // The rendering clock is a stale snapshot from just before creation.
    const stale = created - 900
    expect(remainingMs(timer, stale)).toBeLessThanOrEqual(timer.totalMs)
    expect(remainingMs(timer, stale)).toBe(timer.totalMs)
    expect(formatRemaining(remainingMs(timer, stale))).toBe('20:00')
  })

  it('shows exactly the requested duration on a clock in step with it', () => {
    const created = 1_000_000
    for (const minutes of [1, 5, 20, 90]) {
      const timer = timerOf(minutes, created)
      const expected =
        minutes >= 60
          ? `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}:00`
          : `${minutes}:00`
      expect(formatRemaining(remainingMs(timer, created))).toBe(expected)
    }
  })

  it('counts down normally once time has passed', () => {
    const created = 1_000_000
    const timer = timerOf(20, created)
    expect(formatRemaining(remainingMs(timer, created + 60_000))).toBe('19:00')
    expect(formatRemaining(remainingMs(timer, created + 19 * 60_000 + 30_000))).toBe('0:30')
  })

  it('stops at zero rather than going negative', () => {
    const created = 1_000_000
    const timer = timerOf(20, created)
    expect(remainingMs(timer, created + 30 * 60_000)).toBe(0)
    expect(formatRemaining(remainingMs(timer, created + 30 * 60_000))).toBe('0:00')
  })

  it('honours a paused remainder, still capped at the total', () => {
    const timer = { ...timerOf(20, 1_000_000), remainingMs: 5 * 60_000 }
    expect(formatRemaining(remainingMs(timer, 9_999_999))).toBe('5:00')

    const impossible = { ...timerOf(20, 1_000_000), remainingMs: 25 * 60_000 }
    expect(formatRemaining(remainingMs(impossible, 0))).toBe('20:00')
  })
})

describe('cooking progress across a reload', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)
  })
  afterEach(() => {
    vi.restoreAllMocks()
    window.localStorage.clear()
  })

  it('restores the timers that were running', () => {
    const timer = timerOf(20, Date.now())
    saveProgress({
      recipeId: 'sisofo-forgotten-neapolitan',
      startedAt: new Date(Date.now()).toISOString(),
      currentStep: 1,
      completedStepIds: ['mix'],
      timers: [timer],
    })

    const restored = loadProgress('sisofo-forgotten-neapolitan')
    expect(restored?.timers).toHaveLength(1)
    expect(restored?.timers[0]?.totalMs).toBe(timer.totalMs)
    expect(restored?.currentStep).toBe(1)
    expect(restored?.completedStepIds).toEqual(['mix'])

    // Restored ten minutes later, the timer shows ten minutes left -- the end
    // time is absolute, so a closed tab does not stop the clock.
    expect(formatRemaining(remainingMs(restored!.timers[0]!, Date.now() + 10 * 60_000))).toBe(
      '10:00',
    )
  })

  it('ignores progress stored under a different recipe', () => {
    window.localStorage.setItem(
      storageKeyFor('other'),
      JSON.stringify({ recipeId: 'not-other', timers: [] }),
    )
    expect(loadProgress('other')).toBeNull()
  })

  it('forgets everything once cleared', () => {
    saveProgress({
      recipeId: 'x',
      startedAt: new Date().toISOString(),
      currentStep: 0,
      completedStepIds: [],
      timers: [],
    })
    clearProgress('x')
    expect(loadProgress('x')).toBeNull()
  })
})
