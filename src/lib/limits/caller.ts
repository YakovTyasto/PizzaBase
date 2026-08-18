import 'server-only'
import { isDemoMode } from '@/lib/config/env'
import { readSessionId } from '@/lib/data/demo/session'
import { rateKeyFor } from './rate'

/**
 * Who to charge a rate-limited call to.
 *
 * The signed-in user when there is one, the demo session otherwise. Both are
 * hashed by `rateKeyFor` before they are stored, so the limiter's map holds no
 * identity of its own.
 */
export async function callerKey(): Promise<string> {
  if (!isDemoMode()) {
    try {
      const { createClient } = await import('@/lib/supabase/server')
      const supabase = await createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) return rateKeyFor(user.id)
    } catch {
      // Not signed in, or Supabase unreachable: fall through to the session.
    }
  }

  return rateKeyFor(await readSessionId())
}
