import type { Locale } from './model'

/**
 * Normalizes text for matching: case-folded, diacritics stripped, punctuation
 * collapsed. This is what lets a Russian query find an ingredient stored with a
 * French alias -- "roquette", "Roquette" and "ROQUETTE" all reduce to the same
 * key, and so does "rucola" vs "rùcola".
 *
 * Postgres does the same job server-side with `unaccent`; this mirror exists so
 * the demo repository and client-side filtering behave identically.
 */
export function normalizeForSearch(input: string): string {
  return (
    input
      .normalize('NFD')
      // Strip combining marks, which covers Latin accents and, because NFD also
      // decomposes them, the Cyrillic ё -> е and й -> и spelling differences.
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim()
  )
}

/** The key everything is indexed and compared by. */
export function searchKey(input: string): string {
  return normalizeForSearch(input)
}

export interface AliasEntry {
  ingredientId: string
  locale: Locale | null
  alias: string
}

export interface AliasIndex {
  /** Ingredient ids whose name or alias matches, in any locale. */
  lookup(query: string): string[]
  /** True when this exact ingredient matches the query. */
  matches(ingredientId: string, query: string): boolean
}

/**
 * Builds a multilingual alias index. Matching is substring-based on the
 * normalized key so that "рукк" finds "руккола" and "arug" finds "arugula",
 * regardless of the locale the user is currently browsing in.
 */
export function buildAliasIndex(entries: readonly AliasEntry[]): AliasIndex {
  const keyed = entries.map((entry) => ({
    ingredientId: entry.ingredientId,
    key: searchKey(entry.alias),
  }))

  return {
    lookup(query) {
      const q = searchKey(query)
      if (!q) return []
      const hits = new Set<string>()
      for (const entry of keyed) {
        if (entry.key.includes(q) || q.includes(entry.key)) hits.add(entry.ingredientId)
      }
      return [...hits]
    },
    matches(ingredientId, query) {
      const q = searchKey(query)
      if (!q) return true
      return keyed.some(
        (entry) =>
          entry.ingredientId === ingredientId && (entry.key.includes(q) || q.includes(entry.key)),
      )
    },
  }
}

/** Simple relevance score: exact match beats prefix beats substring. */
export function scoreMatch(candidate: string, query: string): number {
  const c = searchKey(candidate)
  const q = searchKey(query)
  if (!q) return 0
  if (c === q) return 100
  if (c.startsWith(q)) return 75
  if (c.includes(q)) return 50
  return 0
}
