import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * Startup validation.
 *
 * The point is to fail loudly on a configuration that would otherwise look
 * fine and behave wrongly -- a deployment silently serving demo data, or a
 * Supabase project nobody can sign in to.
 */

const ORIGINAL = { ...process.env }

async function validateWith(env: Record<string, string | undefined>) {
  vi.resetModules()
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('NEXT_PUBLIC_') || key.startsWith('IMPASTO_')) delete process.env[key]
  }
  delete process.env.DEMO_MODE
  delete process.env.ALLOWED_EMAILS
  delete process.env.OPENFOODFACTS_USER_AGENT
  Object.assign(process.env, env)

  const config = await import('./env')
  config.resetServerEnvCache()
  return config.validateStartup()
}

afterEach(() => {
  process.env = { ...ORIGINAL }
  vi.resetModules()
})

describe('a coherent configuration', () => {
  it('accepts demo mode with nothing else set', async () => {
    const problems = await validateWith({
      DEMO_MODE: 'true',
      OPENFOODFACTS_USER_AGENT: 'Impasto/1.0 (owner@impasto.test)',
    })
    expect(problems.filter((p) => p.severity === 'error')).toEqual([])
  })

  it('accepts Supabase with an allowlist', async () => {
    const problems = await validateWith({
      NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
      NEXT_PUBLIC_APP_URL: 'https://impasto.test',
      ALLOWED_EMAILS: 'owner@impasto.test',
      OPENFOODFACTS_USER_AGENT: 'Impasto/1.0 (owner@impasto.test)',
    })
    expect(problems.filter((p) => p.severity === 'error')).toEqual([])
  })
})

describe('configurations that would fail quietly', () => {
  it('refuses half-configured Supabase', async () => {
    const problems = await validateWith({
      NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
      OPENFOODFACTS_USER_AGENT: 'Impasto/1.0 (owner@impasto.test)',
    })
    // A URL with no key silently falls back to demo mode, which is the worst
    // possible outcome: a real deployment serving fixtures.
    expect(problems.some((p) => p.severity === 'error' && p.variable.includes('SUPABASE'))).toBe(
      true,
    )
  })

  it('refuses a database nobody can sign in to', async () => {
    const problems = await validateWith({
      NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
      NEXT_PUBLIC_APP_URL: 'https://impasto.test',
      OPENFOODFACTS_USER_AGENT: 'Impasto/1.0 (owner@impasto.test)',
    })
    expect(problems.some((p) => p.variable === 'ALLOWED_EMAILS' && p.severity === 'error')).toBe(
      true,
    )
  })

  it('refuses the translation mock outside demo mode', async () => {
    const problems = await validateWith({
      NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
      NEXT_PUBLIC_APP_URL: 'https://impasto.test',
      ALLOWED_EMAILS: 'owner@impasto.test',
      IMPASTO_MOCK_TRANSLATION: 'true',
      OPENFOODFACTS_USER_AGENT: 'Impasto/1.0 (owner@impasto.test)',
    })
    // A test harness that reached production would fake a paid feature.
    expect(
      problems.some((p) => p.variable === 'IMPASTO_MOCK_TRANSLATION' && p.severity === 'error'),
    ).toBe(true)
  })

  it('does not call a demo deployment broken for having no app URL', async () => {
    const problems = await validateWith({
      DEMO_MODE: 'true',
      OPENFOODFACTS_USER_AGENT: 'Impasto/1.0 (owner@impasto.test)',
    })
    // Demo mode sends no email, so there is no magic link to point anywhere.
    expect(problems.some((p) => p.variable === 'NEXT_PUBLIC_APP_URL')).toBe(false)
  })

  it('warns about the placeholder Open Food Facts contact', async () => {
    const problems = await validateWith({ DEMO_MODE: 'true' })
    expect(
      problems.some(
        (p) => p.variable === 'OPENFOODFACTS_USER_AGENT' && p.severity === 'warning',
      ),
    ).toBe(true)
  })
})
