/**
 * What a translation is not allowed to change.
 *
 * A model asked to translate "bake at 250 °C for 90 seconds" will happily
 * return "bake at 480 °F for a minute and a half" -- helpfully, fluently, and
 * catastrophically for a recipe app whose whole premise is that the numbers
 * are the ones the source actually stated. Unit conversion is the domain
 * engine's job, done with decimals; it is never the translator's.
 *
 * So every proposal is checked before it can be applied: pull the numbers,
 * ranges, temperatures, percentages, timecodes and URLs out of both sides and
 * require them to match as multisets. A proposal that fails is shown to the
 * owner as a refusal, not quietly applied.
 */

export type InvariantKind = 'number' | 'temperature' | 'percent' | 'timecode' | 'url'

export interface Invariant {
  kind: InvariantKind
  /** Normalised for comparison: "1,5" and "1.5" are the same figure. */
  value: string
}

const URL_PATTERN = /https?:\/\/[^\s<>"')]+/gi
const TIMECODE_PATTERN = /\b\d{1,3}:[0-5]\d(?::[0-5]\d)?\b/g
const TEMPERATURE_PATTERN = /(-?\d+(?:[.,]\d+)?)\s*°\s*([CF])/gi
const PERCENT_PATTERN = /(\d+(?:[.,]\d+)?)\s*%/g
const NUMBER_PATTERN = /-?\d+(?:[.,]\d+)?/g

function normalizeNumber(raw: string): string {
  const normalized = raw.replace(',', '.')
  // Trailing zeros are not a change of value: "2.50" and "2.5" are one figure.
  const asNumber = Number(normalized)
  return Number.isFinite(asNumber) ? String(asNumber) : normalized
}

/**
 * Every figure and link in a piece of text.
 *
 * Order does not matter -- languages put numbers in different places -- so the
 * result is compared as a multiset.
 */
export function extractInvariants(text: string): Invariant[] {
  const found: Invariant[] = []
  let rest = text

  const take = (pattern: RegExp, handle: (match: RegExpExecArray) => Invariant) => {
    const matches = [...rest.matchAll(pattern)]
    for (const match of matches) found.push(handle(match as RegExpExecArray))
    // Consumed, so a URL's digits are not counted again as bare numbers and a
    // temperature is not double-counted as both a temperature and a number.
    rest = rest.replace(pattern, ' ')
  }

  take(URL_PATTERN, (match) => ({ kind: 'url', value: match[0].replace(/[.,;]+$/, '') }))
  take(TIMECODE_PATTERN, (match) => ({ kind: 'timecode', value: match[0] }))
  take(TEMPERATURE_PATTERN, (match) => ({
    kind: 'temperature',
    value: `${normalizeNumber(match[1]!)}°${match[2]!.toUpperCase()}`,
  }))
  take(PERCENT_PATTERN, (match) => ({ kind: 'percent', value: `${normalizeNumber(match[1]!)}%` }))
  take(NUMBER_PATTERN, (match) => ({ kind: 'number', value: normalizeNumber(match[0]) }))

  return found
}

export interface InvariantDiff {
  ok: boolean
  /** Present in the source but missing from the translation. */
  missing: Invariant[]
  /** Invented by the translation. */
  added: Invariant[]
}

export function compareInvariants(source: string, translated: string): InvariantDiff {
  const before = extractInvariants(source)
  const after = extractInvariants(translated)

  const counts = new Map<string, number>()
  const key = (invariant: Invariant) => `${invariant.kind}:${invariant.value}`

  for (const invariant of before) counts.set(key(invariant), (counts.get(key(invariant)) ?? 0) + 1)
  for (const invariant of after) counts.set(key(invariant), (counts.get(key(invariant)) ?? 0) - 1)

  const missing: Invariant[] = []
  const added: Invariant[] = []
  for (const [entry, count] of counts) {
    const [kind, ...rest] = entry.split(':')
    const invariant: Invariant = { kind: kind as InvariantKind, value: rest.join(':') }
    for (let i = 0; i < count; i += 1) missing.push(invariant)
    for (let i = 0; i < -count; i += 1) added.push(invariant)
  }

  return { ok: missing.length === 0 && added.length === 0, missing, added }
}

/** A one-line explanation of a refusal, for the review panel. */
export function describeDiff(diff: InvariantDiff): string {
  const parts: string[] = []
  if (diff.missing.length > 0) parts.push(`lost ${diff.missing.map((i) => i.value).join(', ')}`)
  if (diff.added.length > 0) parts.push(`invented ${diff.added.map((i) => i.value).join(', ')}`)
  return parts.join('; ')
}
