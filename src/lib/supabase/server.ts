import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { serverEnv } from '@/lib/config/env'

export class SupabaseNotConfiguredError extends Error {
  constructor() {
    super('Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.')
    this.name = 'SupabaseNotConfiguredError'
  }
}

/**
 * Request-scoped client that reads the user's session from cookies, so every
 * query runs as that user and RLS applies.
 */
export async function createClient() {
  const env = serverEnv()
  if (!env.supabaseUrl || !env.supabaseAnonKey) throw new SupabaseNotConfiguredError()

  const cookieStore = await cookies()

  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Called from a Server Component, where cookies are read-only. The
          // proxy refreshes the session instead, so this is safe to ignore.
        }
      },
    },
  })
}

/**
 * Service-role client. Bypasses RLS entirely, so it is confined to sign-in
 * allowlist checks and seeding. It must never be constructed in the browser --
 * `server-only` above makes that a build error rather than a leak.
 */
export function createAdminClient() {
  const env = serverEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    throw new SupabaseNotConfiguredError()
  }
  return createServerClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    cookies: { getAll: () => [], setAll: () => {} },
  })
}
