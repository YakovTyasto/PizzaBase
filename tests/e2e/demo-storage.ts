import { randomUUID } from 'node:crypto'
import os from 'node:os'
import path from 'node:path'

/**
 * Where the E2E run keeps its demo-mode data.
 *
 * Not inside the repository. The default overlay directory is
 * `<project>/.impasto-demo`, and when the project itself sits in a synced
 * folder -- OneDrive, Dropbox, iCloud -- the sync client holds file handles
 * open for a few milliseconds at a time. The overlay's write-then-rename then
 * comes back `EPERM` under concurrent load, and a suite that runs ten workers
 * against one server hits that often enough to fail runs for reasons that have
 * nothing to do with the app.
 *
 * A directory under the OS temp folder has no such observer. The production
 * retry for transient locks stays where it is -- a real user's project may well
 * be in a synced folder -- but the test suite does not depend on it working.
 *
 * The path is fixed once per Playwright process and passed on through the
 * environment, so the config, the global setup and the global teardown all
 * name the same directory without recomputing it.
 */

const ENV_KEY = 'IMPASTO_E2E_DEMO_DIR'

/** Prefix every directory this suite creates shares, so cleanup can check it. */
export const E2E_DIR_PREFIX = 'impasto-e2e-'

function resolveDir(): string {
  const existing = process.env[ENV_KEY]
  if (existing) return existing

  const dir = path.join(os.tmpdir(), `${E2E_DIR_PREFIX}${randomUUID()}`)
  process.env[ENV_KEY] = dir
  return dir
}

export const E2E_DEMO_DIR = resolveDir()

/**
 * Whether a path is one of ours, and therefore safe to delete.
 *
 * Teardown removes a directory recursively, so it checks first that the path
 * is under the OS temp folder *and* carries this suite's prefix. Nothing
 * outside that can be removed by a misconfigured environment variable.
 */
export function isOwnedByTests(dir: string): boolean {
  const resolved = path.resolve(dir)
  const tmp = path.resolve(os.tmpdir())
  const relative = path.relative(tmp, resolved)

  if (relative.startsWith('..') || path.isAbsolute(relative)) return false
  return path.basename(resolved).startsWith(E2E_DIR_PREFIX)
}
