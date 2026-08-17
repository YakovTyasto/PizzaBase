/**
 * Backward scheduling from the moment the pizza hits the table.
 *
 * The planner is deliberately dumb about biology: it lays out the durations the
 * recipe actually states and never predicts fermentation from temperature on
 * its own. A recipe that carries no correction model gets an "approximate"
 * badge and its sensory cues, because telling someone their dough is ready at
 * 14:32 when it is not is worse than telling them to look at the dough.
 */

export type SchedulePreference = 'short' | 'target' | 'long'

export type StepPhase =
  | 'preferment'
  | 'mix'
  | 'bulk'
  | 'fold'
  | 'ball'
  | 'cold_proof'
  | 'warm_up'
  | 'shape'
  | 'bake'
  | 'serve'
  | 'prep'
  | 'other'

export interface PlannableStep {
  id: string
  sortOrder: number
  phase: StepPhase
  /** Hands-on minutes. */
  activeMinutes: number
  /** Waiting window; `max` may equal `min` for a fixed wait. */
  waitMinMinutes: number
  waitMaxMinutes: number
  /** True when the step's duration is stated by the source rather than guessed. */
  durationKnown: boolean
}

export interface ScheduledStep {
  stepId: string
  phase: StepPhase
  startAt: Date
  endAt: Date
  activeMinutes: number
  waitMinutes: number
  /** The step's timing came from the recipe, not from an assumption. */
  durationKnown: boolean
}

export interface FermentationPlan {
  serveAt: Date
  startAt: Date
  totalMinutes: number
  steps: ScheduledStep[]
  /** True when at least one step had no stated duration. */
  hasApproximateTiming: boolean
}

function chosenWait(step: PlannableStep, preference: SchedulePreference): number {
  if (preference === 'short') return step.waitMinMinutes
  if (preference === 'long') return step.waitMaxMinutes
  // 'target' sits in the middle of the stated window.
  return (step.waitMinMinutes + step.waitMaxMinutes) / 2
}

export class FermentationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FermentationError'
  }
}

/**
 * Walks the steps in reverse from `serveAt`, so the answer to "when do I start
 * the poolish?" falls out of when dinner is.
 */
export function planBackwards(
  steps: readonly PlannableStep[],
  serveAt: Date,
  preference: SchedulePreference = 'target',
): FermentationPlan {
  if (Number.isNaN(serveAt.getTime())) {
    throw new FermentationError('Serve time is not a valid date')
  }
  const ordered = [...steps].sort((a, b) => a.sortOrder - b.sortOrder)
  const scheduled: ScheduledStep[] = []

  let cursor = serveAt.getTime()
  for (let i = ordered.length - 1; i >= 0; i--) {
    const step = ordered[i]!
    const wait = chosenWait(step, preference)
    const minutes = step.activeMinutes + wait
    const startMs = cursor - minutes * 60_000
    scheduled.unshift({
      stepId: step.id,
      phase: step.phase,
      startAt: new Date(startMs),
      endAt: new Date(cursor),
      activeMinutes: step.activeMinutes,
      waitMinutes: wait,
      durationKnown: step.durationKnown,
    })
    cursor = startMs
  }

  const startAt = new Date(cursor)
  return {
    serveAt,
    startAt,
    totalMinutes: Math.round((serveAt.getTime() - cursor) / 60_000),
    steps: scheduled,
    hasApproximateTiming: ordered.some((s) => !s.durationKnown),
  }
}

/** The total window a recipe can occupy, for "this needs 24-48 h" messaging. */
export function totalWindowMinutes(steps: readonly PlannableStep[]): {
  min: number
  max: number
} {
  return steps.reduce(
    (acc, s) => ({
      min: acc.min + s.activeMinutes + s.waitMinMinutes,
      max: acc.max + s.activeMinutes + s.waitMaxMinutes,
    }),
    { min: 0, max: 0 },
  )
}

function icsEscape(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

function icsStamp(date: Date): string {
  return `${date.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`
}

/**
 * Exports the plan as an .ics calendar so the schedule lives where the user
 * already looks. Only steps with real waiting time become events; a 2-minute
 * "add salt" is noise in a calendar.
 */
export function planToIcs(
  plan: FermentationPlan,
  titles: Record<string, string>,
  calendarName: string,
): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Impasto//Fermentation Planner//EN',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${icsEscape(calendarName)}`,
  ]

  for (const step of plan.steps) {
    if (step.waitMinutes < 15 && step.phase !== 'bake' && step.phase !== 'serve') continue
    lines.push(
      'BEGIN:VEVENT',
      `UID:${step.stepId}@impasto`,
      `DTSTAMP:${icsStamp(new Date())}`,
      `DTSTART:${icsStamp(step.startAt)}`,
      `DTEND:${icsStamp(step.endAt)}`,
      `SUMMARY:${icsEscape(titles[step.stepId] ?? step.phase)}`,
      ...(step.durationKnown ? [] : ['DESCRIPTION:Approximate timing - check the dough']),
      'END:VEVENT',
    )
  }

  lines.push('END:VCALENDAR')
  // RFC 5545 wants CRLF line endings.
  return `${lines.join('\r\n')}\r\n`
}
