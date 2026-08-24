import { z } from 'zod'
import { appConfig } from './app-config'

/**
 * Environment validation.
 *
 * Nothing here throws at import time for a missing *optional* key: the whole
 * point of demo mode is that the app boots and is fully usable with an empty
 * `.env`. What is validated is that anything present is well-formed, and that
 * the server-only secrets never leak into a client bundle.
 */

const optionalUrl = z
  .string()
  .trim()
  .url()
  .optional()
  .or(z.literal('').transform(() => undefined))

const optionalString = z
  .string()
  .trim()
  .min(1)
  .optional()
  .or(z.literal('').transform(() => undefined))

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: optionalUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalString,
  NEXT_PUBLIC_APP_URL: optionalUrl,
  NEXT_PUBLIC_DEMO_MODE: optionalString,
})

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: optionalString,
  IMPASTO_DEMO_DIR: optionalString,
  IMPASTO_DEMO_READONLY: optionalString,
  VERCEL: optionalString,
  ALLOWED_EMAILS: optionalString,
  OPENAI_API_KEY: optionalString,
  OPENAI_BASE_URL: optionalUrl,
  OPENAI_MODEL: optionalString,
  SUPADATA_API_KEY: optionalString,
  OPENFOODFACTS_USER_AGENT: optionalString,
  DEMO_MODE: optionalString,
  IMPASTO_MOCK_TRANSLATION: optionalString,
  VAPID_PUBLIC_KEY: optionalString,
  VAPID_PRIVATE_KEY: optionalString,
  VAPID_SUBJECT: optionalString,
})

export class ConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigError'
  }
}

function parsePublic() {
  // Next.js inlines `process.env.NEXT_PUBLIC_*` at build time only for literal
  // property access, so these cannot be read through a loop.
  const result = publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_DEMO_MODE: process.env.NEXT_PUBLIC_DEMO_MODE,
  })
  if (!result.success) {
    throw new ConfigError(
      `Invalid public environment configuration:\n${formatIssues(result.error)}`,
    )
  }
  return result.data
}

function formatIssues(error: z.ZodError): string {
  return error.issues.map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`).join('\n')
}

export const publicEnv = parsePublic()

const isTruthy = (value: string | undefined) =>
  value === '1' || value?.toLowerCase() === 'true' || value?.toLowerCase() === 'yes'

/**
 * Demo mode: no Supabase credentials, or explicitly requested. The app then
 * serves the seeded catalog from memory so a first run needs no accounts, no
 * database and no API keys.
 */
export function isDemoMode(): boolean {
  if (isTruthy(publicEnv.NEXT_PUBLIC_DEMO_MODE)) return true
  if (typeof window === 'undefined' && isTruthy(process.env.DEMO_MODE)) return true
  return !publicEnv.NEXT_PUBLIC_SUPABASE_URL || !publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY
}

/**
 * Where the app's data actually lives.
 *
 * `demo` and `demo-readonly` are the same seed catalog; the difference is
 * whether the process can keep anything the owner changes.
 *
 * On a serverless platform the deployment bundle is read-only, so the demo
 * overlay -- a JSON file under the project directory -- cannot be written at
 * all. The old code found that out by calling `mkdir` and letting an `ENOENT`
 * for `/var/task/.impasto-demo` reach the user, after the UI had already shown
 * the write as successful. Knowing the mode up front means the app can say
 * "read-only" honestly and refuse the write before anything optimistic happens.
 */
export type StorageMode = 'supabase' | 'demo' | 'demo-readonly'

/**
 * Whether the demo overlay can be persisted by this process.
 *
 * `IMPASTO_DEMO_DIR` is an explicit statement by whoever set it that the path
 * is writable -- pointing it at `/tmp` is how a serverless demo can keep data
 * for the life of one instance -- and `IMPASTO_DEMO_READONLY` forces the
 * read-only path, which is what the tests use to reproduce the platform.
 */
export function isDemoWritable(): boolean {
  if (typeof window !== 'undefined') return false
  if (isTruthy(process.env.IMPASTO_DEMO_READONLY)) return false
  if (process.env.IMPASTO_DEMO_DIR) return true
  // Vercel sets VERCEL=1 in every runtime, build and preview environment.
  return !process.env.VERCEL
}

export function storageMode(): StorageMode {
  if (!isDemoMode()) return 'supabase'
  return isDemoWritable() ? 'demo' : 'demo-readonly'
}

/** True when the current backend refuses every write. */
export function isReadOnly(): boolean {
  return storageMode() === 'demo-readonly'
}

/**
 * The bare origin of a configured URL, or null when it is not a URL at all.
 *
 * `NEXT_PUBLIC_APP_URL` is joined with `/auth/callback` to build the magic-link
 * destination, so anything after the host silently corrupts that link. Copying
 * the address out of a browser is the obvious way to set this variable, and a
 * browser is always showing a *page* -- `https://example.com/ru` -- which would
 * produce `https://example.com/ru/auth/callback`: a 404, and a sign-in that
 * cannot complete. Normalising here means a paste like that still works, and
 * `validateStartup` says what was ignored so the variable gets corrected.
 */
export function originOf(value: string | undefined): string | undefined {
  if (!value) return undefined
  try {
    return new URL(value).origin
  } catch {
    return undefined
  }
}

/** True when a configured URL carries anything beyond its origin. */
export function hasPathBeyondOrigin(value: string | undefined): boolean {
  if (!value) return false
  try {
    const url = new URL(value)
    return url.pathname !== '/' || url.search !== '' || url.hash !== ''
  } catch {
    return false
  }
}

export interface ServerEnv {
  supabaseUrl?: string
  supabaseAnonKey?: string
  supabaseServiceRoleKey?: string
  allowedEmails: string[]
  openaiApiKey?: string
  openaiBaseUrl: string
  openaiModel: string
  supadataApiKey?: string
  openFoodFactsUserAgent: string
  appUrl: string
  demoMode: boolean
  storageMode: StorageMode
  /** False when every mutation must be refused rather than attempted. */
  writable: boolean
}

let cachedServerEnv: ServerEnv | null = null

/**
 * Server-only configuration. Calling this from the browser is a programming
 * error and throws rather than silently returning empty secrets.
 */
export function serverEnv(): ServerEnv {
  if (typeof window !== 'undefined') {
    throw new ConfigError('serverEnv() must never be called in the browser')
  }
  if (cachedServerEnv) return cachedServerEnv

  const parsed = serverSchema.safeParse(process.env)
  if (!parsed.success) {
    throw new ConfigError(
      `Invalid server environment configuration:\n${formatIssues(parsed.error)}`,
    )
  }
  const data = parsed.data

  cachedServerEnv = {
    supabaseUrl: publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    supabaseServiceRoleKey: data.SUPABASE_SERVICE_ROLE_KEY,
    allowedEmails: (data.ALLOWED_EMAILS ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
    openaiApiKey: data.OPENAI_API_KEY,
    openaiBaseUrl: data.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
    openaiModel: data.OPENAI_MODEL ?? 'gpt-4.1-mini',
    supadataApiKey: data.SUPADATA_API_KEY,
    openFoodFactsUserAgent:
      data.OPENFOODFACTS_USER_AGENT ?? `${appConfig.name}/${appConfig.version}`,
    appUrl: originOf(publicEnv.NEXT_PUBLIC_APP_URL) ?? 'http://localhost:3000',
    demoMode: isDemoMode(),
    storageMode: storageMode(),
    writable: storageMode() !== 'demo-readonly',
  }
  return cachedServerEnv
}

/** Reset between tests. */
export function resetServerEnvCache(): void {
  cachedServerEnv = null
}

/**
 * The checks that must pass before a deployment is allowed to serve.
 *
 * Distinct from `configReport`, which describes what is switched on. This
 * answers a narrower question -- is this configuration *coherent* -- and it is
 * the one worth failing a startup over. A missing OpenAI key is a feature that
 * is off; a Supabase URL with no key, or a production deployment that would
 * silently serve the demo seed, is a mistake.
 */
export interface StartupProblem {
  variable: string
  message: string
  severity: 'error' | 'warning'
}

export function validateStartup(): StartupProblem[] {
  const env = serverEnv()
  const problems: StartupProblem[] = []

  const halfConfigured = Boolean(env.supabaseUrl) !== Boolean(env.supabaseAnonKey)
  if (halfConfigured) {
    problems.push({
      variable: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY',
      message: 'Set both or neither. One without the other falls back to demo mode silently.',
      severity: 'error',
    })
  }

  if (!env.demoMode && env.allowedEmails.length === 0) {
    problems.push({
      variable: 'ALLOWED_EMAILS',
      message: 'Supabase is configured but nobody is allowed to sign in.',
      severity: 'error',
    })
  }

  if (process.env.NODE_ENV === 'production' && env.storageMode === 'demo') {
    problems.push({
      variable: 'DEMO_MODE',
      message:
        'This deployment serves the bundled seed and stores changes on the server’s disk. ' +
        'Set Supabase credentials and DEMO_MODE=false for a real deployment.',
      severity: 'warning',
    })
  }

  // Not an error: a read-only demo is a coherent, honest configuration -- the
  // catalog is fully browsable and every write is refused up front. It is only
  // a mistake if someone expected it to keep their data.
  if (env.storageMode === 'demo-readonly') {
    problems.push({
      variable: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY',
      message:
        'Read-only demo: this platform has no writable filesystem, so nothing can be saved. ' +
        'Connect Supabase to make changes persist.',
      severity: 'warning',
    })
  }

  // Only when there are magic links to send. A demo deployment has no email
  // at all, so calling this an error there would report a healthy site as
  // broken -- and a health check that cries wolf gets ignored.
  if (process.env.NODE_ENV === 'production' && !env.demoMode && !publicEnv.NEXT_PUBLIC_APP_URL) {
    problems.push({
      variable: 'NEXT_PUBLIC_APP_URL',
      message: 'Magic-link emails will point at localhost without it.',
      severity: 'error',
    })
  }

  // An origin, not a page. The value is joined with `/auth/callback`, so a
  // locale or any other path in it produces a link that 404s -- and the sign-in
  // simply never completes, with nothing on screen to say why. The path is
  // ignored rather than obeyed; this is what says so.
  if (hasPathBeyondOrigin(publicEnv.NEXT_PUBLIC_APP_URL)) {
    problems.push({
      variable: 'NEXT_PUBLIC_APP_URL',
      message:
        `Must be an origin such as ${originOf(publicEnv.NEXT_PUBLIC_APP_URL) ?? 'https://example.com'}, ` +
        'with no path. Everything after the host is ignored when building the magic-link callback.',
      severity: 'error',
    })
  }

  if (process.env.IMPASTO_MOCK_TRANSLATION === 'true' && !env.demoMode) {
    problems.push({
      variable: 'IMPASTO_MOCK_TRANSLATION',
      message: 'The translation mock is a test harness and must not be set outside demo mode.',
      severity: 'error',
    })
  }

  // Their usage policy asks for a way to reach whoever is making the requests.
  // The default carries none, and the one in .env.example is a placeholder.
  const agent = env.openFoodFactsUserAgent
  const hasContact = /@|https?:\/\//.test(agent) && !agent.includes('example.com')
  if (!hasContact) {
    problems.push({
      variable: 'OPENFOODFACTS_USER_AGENT',
      message: 'Open Food Facts asks for a real contact address in the User-Agent.',
      severity: 'warning',
    })
  }

  return problems
}

export interface ConfigReport {
  demoMode: boolean
  storageMode: StorageMode
  writable: boolean
  supabase: boolean
  allowlistConfigured: boolean
  providers: { openai: boolean; supadata: boolean; openFoodFacts: boolean }
  warnings: string[]
}

/**
 * A human-readable view of what is and is not wired up, surfaced on the
 * Settings screen so the user can see exactly which key is missing rather than
 * meeting a dead button.
 */
export function configReport(): ConfigReport {
  const env = serverEnv()
  const warnings: string[] = []

  if (env.storageMode === 'demo') {
    warnings.push('Demo mode: data is served from the bundled seed and kept only on this machine.')
  }
  if (env.storageMode === 'demo-readonly') {
    warnings.push(
      'Read-only demo: this platform has no writable storage, so every change is refused. ' +
        'Connect Supabase to save anything.',
    )
  }
  if (env.supabaseUrl && !env.supabaseServiceRoleKey) {
    warnings.push('SUPABASE_SERVICE_ROLE_KEY is unset; server-side admin tasks are disabled.')
  }
  if (!env.demoMode && env.allowedEmails.length === 0) {
    warnings.push('ALLOWED_EMAILS is empty, so no one can sign in.')
  }

  return {
    demoMode: env.demoMode,
    storageMode: env.storageMode,
    writable: env.writable,
    supabase: Boolean(env.supabaseUrl && env.supabaseAnonKey),
    allowlistConfigured: env.allowedEmails.length > 0,
    providers: {
      openai: Boolean(env.openaiApiKey),
      supadata: Boolean(env.supadataApiKey),
      openFoodFacts: true,
    },
    warnings,
  }
}

export function isEmailAllowed(email: string): boolean {
  const env = serverEnv()
  if (env.allowedEmails.length === 0) return false
  return env.allowedEmails.includes(email.trim().toLowerCase())
}
