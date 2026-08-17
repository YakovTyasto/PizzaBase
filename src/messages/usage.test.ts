import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import en from './en.json'

/**
 * Every message key referenced in the source must exist.
 *
 * A missing key is invisible at build time and only surfaces as a runtime
 * MISSING_MESSAGE when someone opens the screen -- which is exactly how a whole
 * block of auth strings once went missing after a careless edit. This walks the
 * source for literal `t('...')` calls and checks each one.
 */

const SOURCE_ROOT = path.join(process.cwd(), 'src')

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) return walk(full)
    return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [full] : []
  })
}

interface Usage {
  key: string
  /** Namespaces bound anywhere in the file, if any. */
  namespaces: string[]
  file: string
}

/**
 * Collects `t('key')` calls together with any namespaces the file binds.
 *
 * A file can hold several translation bindings at once -- a namespaced one for
 * `generateMetadata` and a bare one for the body -- so a key is accepted if it
 * resolves either absolutely or under any namespace present in that file.
 * That still catches a key which exists nowhere, which is the failure this
 * test is for.
 *
 * Template-literal keys (`t(`units.${unit}`)`) cannot be resolved statically
 * and are skipped; the parity test covers those instead.
 */
function collectUsages(): Usage[] {
  const usages: Usage[] = []

  for (const file of walk(SOURCE_ROOT)) {
    const source = readFileSync(file, 'utf8')

    const namespaces = [
      ...[...source.matchAll(/useTranslations\(\s*'([\w.]+)'\s*\)/g)].map((m) => m[1]!),
      ...[...source.matchAll(/namespace:\s*'([\w.]+)'/g)].map((m) => m[1]!),
    ]

    for (const match of source.matchAll(/\bt\(\s*'([\w.]+)'/g)) {
      usages.push({ key: match[1]!, namespaces, file })
    }
  }

  return usages
}

function hasKey(tree: unknown, dotted: string): boolean {
  let node: unknown = tree
  for (const part of dotted.split('.')) {
    if (typeof node !== 'object' || node === null) return false
    node = (node as Record<string, unknown>)[part]
    if (node === undefined) return false
  }
  return typeof node === 'string'
}

describe('message usage', () => {
  const usages = collectUsages()

  it('finds message keys to check', () => {
    expect(usages.length).toBeGreaterThan(50)
  })

  it('resolves every literal key used in the source', () => {
    const missing = usages
      .filter(
        (usage) =>
          !hasKey(en, usage.key) &&
          !usage.namespaces.some((namespace) => hasKey(en, `${namespace}.${usage.key}`)),
      )
      .map((usage) => `${usage.key}  (${path.relative(process.cwd(), usage.file)})`)

    // Deduplicate so one shared component does not flood the output.
    expect([...new Set(missing)]).toEqual([])
  })
})
