'use client'

import { createBrowserClient } from '@supabase/ssr'
import { publicEnv } from '@/lib/config/env'

/**
 * Browser client. Only ever sees the anon key -- the service role key is
 * confined to `server.ts`, which is marked `server-only`.
 */
export function createClient() {
  const url = publicEnv.NEXT_PUBLIC_SUPABASE_URL
  const key = publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error('Supabase is not configured; the app is running in demo mode.')
  }
  return createBrowserClient(url, key)
}
