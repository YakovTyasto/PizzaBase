import { rmSync } from 'node:fs'
import { E2E_DEMO_DIR, isOwnedByTests } from './demo-storage'

/**
 * Removes the run's demo storage.
 *
 * Scoped by `isOwnedByTests`: only a directory under the OS temp folder that
 * carries this suite's prefix is ever removed, so pointing
 * `IMPASTO_E2E_DEMO_DIR` somewhere else cannot turn teardown into a delete of
 * something that matters.
 */
export default function globalTeardown(): void {
  if (process.env.E2E_BASE_URL) return
  if (!isOwnedByTests(E2E_DEMO_DIR)) return

  rmSync(E2E_DEMO_DIR, { recursive: true, force: true })
}
