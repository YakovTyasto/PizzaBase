import 'server-only'
import { type ActionError, ReadOnlyStoreError } from './errors'
import { RepositoryError } from './demo/repository'

/**
 * Turns anything thrown by a repository into an answer that is safe to send.
 *
 * Every mutation funnels through here, which is the single place that decides
 * what a user is allowed to learn about a failure. Nothing derived from an
 * exception's `message` ever crosses the boundary: the code is looked up from
 * the *type* of the error, and the original is written to the server log where
 * it belongs.
 */
export function toActionError(error: unknown, context: string): ActionError {
  if (error instanceof ReadOnlyStoreError) {
    // Expected and explanatory rather than a fault; no log line needed.
    return { code: 'readonly' }
  }

  if (error instanceof RepositoryError) {
    switch (error.code) {
      case 'readonly':
        return { code: 'readonly' }
      case 'not_found':
        return { code: 'not_found' }
      case 'cycle':
        return { code: 'cycle' }
      case 'conflict':
        return { code: 'conflict' }
      case 'validation':
        return { code: 'validation' }
    }
  }

  // Anything else is a genuine surprise. It is logged with its context so it
  // can be found, and reported to the user as nothing more than "it failed".
  console.error(`[${context}]`, error)
  return { code: 'unknown' }
}
