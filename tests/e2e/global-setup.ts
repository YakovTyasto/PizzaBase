import { mkdirSync, rmSync } from 'node:fs'
import { E2E_DEMO_DIR, isOwnedByTests } from './demo-storage'

/**
 * Gives the run an empty demo-storage directory outside the repository.
 *
 * Emptied rather than merely created, so a run never starts on top of state
 * left by a previous one that was interrupted before its teardown.
 */
export default function globalSetup(): void {
  if (process.env.E2E_BASE_URL) return // An external server owns its own storage.

  if (isOwnedByTests(E2E_DEMO_DIR)) rmSync(E2E_DEMO_DIR, { recursive: true, force: true })
  mkdirSync(E2E_DEMO_DIR, { recursive: true })
}
