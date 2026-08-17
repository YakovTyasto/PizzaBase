import { describe, expect, it } from 'vitest'
import { type PlannableStep, planBackwards, planToIcs, totalWindowMinutes } from './fermentation'

const steps: PlannableStep[] = [
  {
    id: 'mix',
    sortOrder: 1,
    phase: 'mix',
    activeMinutes: 20,
    waitMinMinutes: 0,
    waitMaxMinutes: 0,
    durationKnown: true,
  },
  {
    id: 'bulk',
    sortOrder: 2,
    phase: 'bulk',
    activeMinutes: 0,
    waitMinMinutes: 120,
    waitMaxMinutes: 240,
    durationKnown: true,
  },
  {
    id: 'ball',
    sortOrder: 3,
    phase: 'ball',
    activeMinutes: 15,
    waitMinMinutes: 0,
    waitMaxMinutes: 0,
    durationKnown: true,
  },
  {
    id: 'cold',
    sortOrder: 4,
    phase: 'cold_proof',
    activeMinutes: 0,
    waitMinMinutes: 720,
    waitMaxMinutes: 1440,
    durationKnown: true,
  },
  {
    id: 'bake',
    sortOrder: 5,
    phase: 'bake',
    activeMinutes: 10,
    waitMinMinutes: 0,
    waitMaxMinutes: 0,
    durationKnown: true,
  },
]

const serveAt = new Date('2026-08-20T19:00:00.000Z')

describe('backward fermentation planning', () => {
  it('ends exactly at the serve time', () => {
    const plan = planBackwards(steps, serveAt, 'target')
    expect(plan.steps.at(-1)?.endAt.toISOString()).toBe(serveAt.toISOString())
  })

  it('chains steps without gaps', () => {
    const plan = planBackwards(steps, serveAt, 'target')
    for (let i = 1; i < plan.steps.length; i++) {
      expect(plan.steps[i]!.startAt.getTime()).toBe(plan.steps[i - 1]!.endAt.getTime())
    }
  })

  it('starts earlier when the long end of the window is chosen', () => {
    const short = planBackwards(steps, serveAt, 'short')
    const target = planBackwards(steps, serveAt, 'target')
    const long = planBackwards(steps, serveAt, 'long')
    expect(long.startAt.getTime()).toBeLessThan(target.startAt.getTime())
    expect(target.startAt.getTime()).toBeLessThan(short.startAt.getTime())
  })

  it('computes the total elapsed time', () => {
    const plan = planBackwards(steps, serveAt, 'short')
    // 20 + 120 + 15 + 720 + 10
    expect(plan.totalMinutes).toBe(885)
  })

  it('flags approximate timing when a step has no stated duration', () => {
    const known = planBackwards(steps, serveAt)
    expect(known.hasApproximateTiming).toBe(false)

    const withUnknown = planBackwards(
      [...steps, { ...steps[1]!, id: 'guess', sortOrder: 6, durationKnown: false }],
      serveAt,
    )
    expect(withUnknown.hasApproximateTiming).toBe(true)
  })

  it('respects sort order regardless of input order', () => {
    const shuffled = [steps[3]!, steps[0]!, steps[4]!, steps[1]!, steps[2]!]
    const plan = planBackwards(shuffled, serveAt)
    expect(plan.steps.map((s) => s.stepId)).toEqual(['mix', 'bulk', 'ball', 'cold', 'bake'])
  })

  it('reports the full min/max window', () => {
    expect(totalWindowMinutes(steps)).toEqual({ min: 885, max: 1725 })
  })
})

describe('ics export', () => {
  it('emits a valid calendar with CRLF line endings', () => {
    const plan = planBackwards(steps, serveAt)
    const ics = planToIcs(plan, { bulk: 'Bulk fermentation' }, 'Impasto')
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true)
    expect(ics).toContain('SUMMARY:Bulk fermentation')
  })

  it('skips trivial steps but keeps the bake', () => {
    const plan = planBackwards(steps, serveAt)
    const ics = planToIcs(plan, {}, 'Impasto')
    expect(ics).not.toContain('UID:ball@impasto')
    expect(ics).toContain('UID:bake@impasto')
  })
})
