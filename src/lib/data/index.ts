import 'server-only'
import { isDemoMode } from '@/lib/config/env'
import { DemoRepository } from './demo/repository'
import { SupabaseRepository } from './supabase/repository'
import type { Repository } from './types'

let demoSingleton: DemoRepository | null = null

/**
 * Picks the backing store. Demo mode is not a lesser path bolted on the side:
 * it implements the same interface, so every screen behaves identically whether
 * or not Supabase is configured.
 */
export function getRepository(): Repository {
  if (isDemoMode()) {
    demoSingleton ??= new DemoRepository()
    return demoSingleton
  }
  return new SupabaseRepository()
}

export * from './types'
