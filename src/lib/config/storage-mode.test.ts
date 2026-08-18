import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Which backend is in play, and whether it can keep anything.
 *
 * The regression these guard: on Vercel with no Supabase project, the app
 * treated itself as an ordinary demo and tried to `mkdir` an overlay directory
 * inside the read-only deployment bundle. The write failed with
 * `ENOENT ... '/var/task/.impasto-demo'`, that message was returned to the
 * browser, and the UI had already shown the change as saved.
 */

const ENV_KEYS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_DEMO_MODE',
  'DEMO_MODE',
  'VERCEL',
  'IMPASTO_DEMO_DIR',
  'IMPASTO_DEMO_READONLY',
] as const

let saved: Record<string, string | undefined>

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]))
  for (const key of ENV_KEYS) delete process.env[key]
  vi.resetModules()
})

afterEach(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  vi.resetModules()
})

/** Re-imported per case: the public env is parsed once at module load. */
async function load() {
  return import('./env')
}

describe('storage mode', () => {
  it('is supabase when both credentials are present', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
    const { storageMode, isReadOnly } = await load()

    expect(storageMode()).toBe('supabase')
    expect(isReadOnly()).toBe(false)
  })

  it('is a writable demo locally with no credentials', async () => {
    const { storageMode, isDemoWritable, isReadOnly } = await load()

    expect(storageMode()).toBe('demo')
    expect(isDemoWritable()).toBe(true)
    expect(isReadOnly()).toBe(false)
  })

  it('is read-only on Vercel with no credentials', async () => {
    process.env.VERCEL = '1'
    const { storageMode, isDemoWritable, isReadOnly } = await load()

    expect(storageMode()).toBe('demo-readonly')
    expect(isDemoWritable()).toBe(false)
    expect(isReadOnly()).toBe(true)
  })

  it('stays writable on Vercel when a writable directory is named', async () => {
    process.env.VERCEL = '1'
    process.env.IMPASTO_DEMO_DIR = '/tmp/impasto'
    const { storageMode } = await load()

    // Setting the variable is an operator saying "this path is writable".
    expect(storageMode()).toBe('demo')
  })

  it('can be forced read-only locally, which is how tests reproduce Vercel', async () => {
    process.env.IMPASTO_DEMO_READONLY = 'true'
    const { storageMode } = await load()

    expect(storageMode()).toBe('demo-readonly')
  })

  it('stays on Supabase on Vercel, because Supabase does not need a filesystem', async () => {
    process.env.VERCEL = '1'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
    const { storageMode } = await load()

    expect(storageMode()).toBe('supabase')
  })
})

describe('what the configuration report says about persistence', () => {
  it('warns that a read-only demo keeps nothing', async () => {
    process.env.VERCEL = '1'
    const { configReport, resetServerEnvCache } = await load()
    resetServerEnvCache()

    const report = configReport()
    expect(report.storageMode).toBe('demo-readonly')
    expect(report.writable).toBe(false)
    expect(report.warnings.join(' ')).toMatch(/read-only/i)
  })

  it('calls a read-only demo a warning, not an error', async () => {
    process.env.VERCEL = '1'
    const { validateStartup, resetServerEnvCache } = await load()
    resetServerEnvCache()

    const problems = validateStartup()
    const readOnly = problems.find((problem) => /read-only/i.test(problem.message))
    expect(readOnly?.severity).toBe('warning')
    // A browsable catalog with every write refused is coherent, not broken.
    expect(problems.filter((problem) => problem.severity === 'error')).toEqual([])
  })

  it('never names a filesystem path in anything it reports', async () => {
    process.env.VERCEL = '1'
    const { configReport, validateStartup, resetServerEnvCache } = await load()
    resetServerEnvCache()

    const text = [
      ...configReport().warnings,
      ...validateStartup().map((problem) => problem.message),
    ].join(' ')

    expect(text).not.toMatch(/\/var\/task/)
    expect(text).not.toMatch(/impasto-demo/)
    expect(text).not.toMatch(/ENOENT/)
  })
})
