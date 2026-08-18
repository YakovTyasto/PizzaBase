import { validateStartup } from '@/lib/config/env'

/**
 * Startup validation.
 *
 * Next.js runs this once per server process, before the first request. A
 * misconfiguration that would otherwise show up as a confusing runtime symptom
 * -- a production deployment quietly serving demo fixtures, a database nobody
 * can sign in to -- is printed here where whoever deployed it will see it.
 *
 * It reports rather than exits: refusing to boot would take a running site
 * down over a warning, and the /api/health endpoint returns 503 for the same
 * problems so a deployment check can fail on them deliberately.
 */
export function register(): void {
  // Only the Node.js runtime has the full environment; the edge copy would
  // report false problems from variables it cannot see.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  let problems: ReturnType<typeof validateStartup>
  try {
    problems = validateStartup()
  } catch (error) {
    console.error(
      '[impasto] Configuration could not be read:',
      error instanceof Error ? error.message : error,
    )
    return
  }

  for (const problem of problems) {
    const prefix = problem.severity === 'error' ? '[impasto] ERROR' : '[impasto] warning'
    console[problem.severity === 'error' ? 'error' : 'warn'](
      `${prefix} ${problem.variable}: ${problem.message}`,
    )
  }
}
