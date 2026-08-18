import { NextResponse } from 'next/server'
import { appConfig } from '@/lib/config/app-config'
import { configReport, validateStartup } from '@/lib/config/env'

/**
 * Liveness and configuration health.
 *
 * Deliberately says nothing a secret could be reconstructed from: which
 * integrations are *on*, never a key, a URL, a project ref or an address. The
 * startup problems are reported by variable name and reason, which is what an
 * operator needs and is already public knowledge from the README.
 *
 * Uncached and dynamic, because a cached health check is not a health check.
 */
export const dynamic = 'force-dynamic'

export async function GET() {
  let problems: ReturnType<typeof validateStartup> = []
  let report: ReturnType<typeof configReport> | null = null

  try {
    problems = validateStartup()
    report = configReport()
  } catch (error) {
    // A configuration too broken to describe is itself the answer.
    return NextResponse.json(
      {
        status: 'misconfigured',
        version: appConfig.version,
        detail: error instanceof Error ? error.message : 'Configuration could not be read',
      },
      { status: 503, headers: { 'cache-control': 'no-store' } },
    )
  }

  const errors = problems.filter((problem) => problem.severity === 'error')

  return NextResponse.json(
    {
      status: errors.length > 0 ? 'misconfigured' : 'ok',
      version: appConfig.version,
      // "demo" keeps its data on the server's own disk; "demo-readonly" cannot
      // keep anything at all. An operator needs to be able to tell a working
      // deployment from a browsable-but-frozen one at a glance.
      mode: report.storageMode,
      writable: report.writable,
      // Booleans only. Whether a key exists is operational; its value is not.
      integrations: {
        supabase: report.supabase,
        allowlist: report.allowlistConfigured,
        openai: report.providers.openai,
        transcripts: report.providers.supadata,
        openFoodFacts: report.providers.openFoodFacts,
      },
      problems: problems.map((problem) => ({
        variable: problem.variable,
        severity: problem.severity,
        message: problem.message,
      })),
    },
    {
      status: errors.length > 0 ? 503 : 200,
      headers: { 'cache-control': 'no-store' },
    },
  )
}
