import { describe, expect, it } from 'vitest'
import { LOCALES } from '@/domain'
import en from './en.json'
import fr from './fr.json'
import ru from './ru.json'

type Tree = { [key: string]: string | Tree }

const catalogs: Record<string, Tree> = { en, ru, fr }

function flatten(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return typeof value === 'string' ? [path] : flatten(value, path)
  })
}

/**
 * Extracts ICU argument names, ignoring the branch bodies of plurals. Only
 * braces at depth 0 open an argument -- `one {штука}` inside a plural is text,
 * not a placeholder, and must not be compared across locales.
 */
function placeholders(value: string): string[] {
  const names: string[] = []
  let depth = 0
  for (let i = 0; i < value.length; i++) {
    const char = value[i]
    if (char === '{') {
      if (depth === 0) {
        const name = /^\w+/.exec(value.slice(i + 1))?.[0]
        if (name) names.push(name)
      }
      depth++
    } else if (char === '}') {
      depth = Math.max(0, depth - 1)
    }
  }
  return names.sort()
}

function entries(tree: Tree, prefix = ''): [string, string][] {
  return Object.entries(tree).flatMap(([key, value]): [string, string][] => {
    const path = prefix ? `${prefix}.${key}` : key
    return typeof value === 'string' ? [[path, value]] : entries(value, path)
  })
}

describe('message catalogs', () => {
  it('covers every supported locale', () => {
    for (const locale of LOCALES) expect(Object.keys(catalogs)).toContain(locale)
  })

  it('has exactly the same keys in all three languages', () => {
    const reference = flatten(en).sort()
    for (const [locale, catalog] of Object.entries(catalogs)) {
      const keys = flatten(catalog).sort()
      const missing = reference.filter((k) => !keys.includes(k))
      const extra = keys.filter((k) => !reference.includes(k))
      expect(missing, `${locale} is missing keys`).toEqual([])
      expect(extra, `${locale} has unexpected keys`).toEqual([])
    }
  })

  it('uses the same placeholders for the same key everywhere', () => {
    const reference = new Map(entries(en))
    for (const [locale, catalog] of Object.entries(catalogs)) {
      for (const [key, value] of entries(catalog)) {
        const expected = placeholders(reference.get(key) ?? '')
        expect(placeholders(value), `${locale}:${key}`).toEqual(expected)
      }
    }
  })

  it('has no empty strings', () => {
    for (const [locale, catalog] of Object.entries(catalogs)) {
      for (const [key, value] of entries(catalog)) {
        expect(value.trim().length, `${locale}:${key} is empty`).toBeGreaterThan(0)
      }
    }
  })

  it('gives Russian plurals their few/many forms', () => {
    // Russian needs one/few/many, not just one/other, or "2 пиццы" breaks.
    for (const [key, value] of entries(ru)) {
      if (!value.includes(', plural,')) continue
      expect(value, `ru:${key} needs a "few" form`).toContain('few {')
      expect(value, `ru:${key} needs a "many" form`).toContain('many {')
    }
  })
})
