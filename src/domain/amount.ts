import { Decimal } from 'decimal.js'
import {
  type QualitativeUnit,
  type Unit,
  areConvertible,
  convert,
  convertWithDensity,
  isQualitativeUnit,
  isUnit,
  measureOf,
} from './units'

/**
 * Amounts are structured, never strings. The four shapes below are the only
 * ones the app recognises, which is what keeps "salt to taste" from ever being
 * turned into an invented number of grams.
 */
export type Amount =
  | { kind: 'exact'; value: Decimal; unit: Unit }
  | { kind: 'range'; min: Decimal; max: Decimal; unit: Unit }
  | { kind: 'qualitative'; unit: QualitativeUnit }
  | { kind: 'unknown' }

export type AmountKind = Amount['kind']

/** Wire/DB representation: `numeric` columns arrive as strings. */
export interface AmountRow {
  amount: string | number | null
  amount_max?: string | number | null
  unit: string | null
  is_qualitative?: boolean | null
}

export function exact(value: Decimal.Value, unit: Unit): Amount {
  return { kind: 'exact', value: new Decimal(value), unit }
}

export function range(min: Decimal.Value, max: Decimal.Value, unit: Unit): Amount {
  const lo = new Decimal(min)
  const hi = new Decimal(max)
  return lo.greaterThan(hi)
    ? { kind: 'range', min: hi, max: lo, unit }
    : { kind: 'range', min: lo, max: hi, unit }
}

export function qualitative(unit: QualitativeUnit): Amount {
  return { kind: 'qualitative', unit }
}

export const UNKNOWN: Amount = { kind: 'unknown' }

export function isNumeric(a: Amount): a is Extract<Amount, { kind: 'exact' | 'range' }> {
  return a.kind === 'exact' || a.kind === 'range'
}

export function unitOf(a: Amount): Unit | null {
  return a.kind === 'unknown' ? null : a.unit
}

/** Parses a DB row into an Amount, defaulting to `unknown` rather than guessing. */
export function parseAmount(row: AmountRow): Amount {
  const rawUnit = row.unit
  if (rawUnit && isUnit(rawUnit) && isQualitativeUnit(rawUnit)) {
    return qualitative(rawUnit)
  }
  if (row.amount === null || row.amount === undefined) return UNKNOWN
  if (!rawUnit || !isUnit(rawUnit)) return UNKNOWN

  const min = new Decimal(row.amount)
  if (row.amount_max !== null && row.amount_max !== undefined) {
    return range(min, new Decimal(row.amount_max), rawUnit)
  }
  return { kind: 'exact', value: min, unit: rawUnit }
}

export function serializeAmount(a: Amount): AmountRow {
  switch (a.kind) {
    case 'exact':
      return { amount: a.value.toString(), amount_max: null, unit: a.unit }
    case 'range':
      return { amount: a.min.toString(), amount_max: a.max.toString(), unit: a.unit }
    case 'qualitative':
      return { amount: null, amount_max: null, unit: a.unit, is_qualitative: true }
    case 'unknown':
      return { amount: null, amount_max: null, unit: null }
  }
}

/**
 * Multiplies an amount by a scale factor. Qualitative and unknown amounts pass
 * through untouched — a pinch of salt stays a pinch at any batch size.
 */
export function scaleAmount(a: Amount, factor: Decimal.Value): Amount {
  const f = new Decimal(factor)
  switch (a.kind) {
    case 'exact':
      return { kind: 'exact', value: a.value.times(f), unit: a.unit }
    case 'range':
      return { kind: 'range', min: a.min.times(f), max: a.max.times(f), unit: a.unit }
    default:
      return a
  }
}

export function convertAmount(
  a: Amount,
  to: Unit,
  density?: Decimal.Value | null,
): Amount {
  if (!isNumeric(a)) return a
  if (a.unit === to) return a
  const doConvert = (v: Decimal) =>
    areConvertible(a.unit, to) ? convert(v, a.unit, to) : convertWithDensity(v, a.unit, to, density)

  return a.kind === 'exact'
    ? { kind: 'exact', value: doConvert(a.value), unit: to }
    : { kind: 'range', min: doConvert(a.min), max: doConvert(a.max), unit: to }
}

export function canCombine(a: Amount, b: Amount, density?: Decimal.Value | null): boolean {
  if (!isNumeric(a) || !isNumeric(b)) return false
  if (areConvertible(a.unit, b.unit)) return true
  if (density === null || density === undefined) return false
  const measures = [measureOf(a.unit), measureOf(b.unit)]
  return measures.includes('mass') && measures.includes('volume')
}

/**
 * Adds two numeric amounts, normalising `b` into `a`'s unit first. Ranges
 * survive addition: exact values are treated as a zero-width range so that
 * `100 g + (1–2 g)` becomes `101–102 g` rather than collapsing to a point.
 */
export function addAmounts(a: Amount, b: Amount, density?: Decimal.Value | null): Amount {
  if (!isNumeric(a) || !isNumeric(b)) {
    throw new Error('Cannot add non-numeric amounts; keep them as separate lines')
  }
  const normalized = convertAmount(b, a.unit, density)
  if (!isNumeric(normalized)) throw new Error('Conversion produced a non-numeric amount')

  const aMin = a.kind === 'exact' ? a.value : a.min
  const aMax = a.kind === 'exact' ? a.value : a.max
  const bMin = normalized.kind === 'exact' ? normalized.value : normalized.min
  const bMax = normalized.kind === 'exact' ? normalized.value : normalized.max

  const min = aMin.plus(bMin)
  const max = aMax.plus(bMax)
  return min.equals(max)
    ? { kind: 'exact', value: min, unit: a.unit }
    : { kind: 'range', min, max, unit: a.unit }
}

export function subtractAmount(a: Amount, b: Amount, density?: Decimal.Value | null): Amount {
  if (!isNumeric(a) || !isNumeric(b)) {
    throw new Error('Cannot subtract non-numeric amounts')
  }
  const normalized = convertAmount(b, a.unit, density)
  if (!isNumeric(normalized)) throw new Error('Conversion produced a non-numeric amount')

  const clampZero = (d: Decimal) => (d.lessThan(0) ? new Decimal(0) : d)
  const aMin = a.kind === 'exact' ? a.value : a.min
  const aMax = a.kind === 'exact' ? a.value : a.max
  const bVal = normalized.kind === 'exact' ? normalized.value : normalized.max

  const min = clampZero(aMin.minus(bVal))
  const max = clampZero(aMax.minus(bVal))
  return min.equals(max)
    ? { kind: 'exact', value: min, unit: a.unit }
    : { kind: 'range', min, max, unit: a.unit }
}

/** The value used when a single number is required (upper bound of a range). */
export function upperBound(a: Amount): Decimal | null {
  if (a.kind === 'exact') return a.value
  if (a.kind === 'range') return a.max
  return null
}

export function lowerBound(a: Amount): Decimal | null {
  if (a.kind === 'exact') return a.value
  if (a.kind === 'range') return a.min
  return null
}

export function isZero(a: Amount): boolean {
  if (a.kind === 'exact') return a.value.isZero()
  if (a.kind === 'range') return a.min.isZero() && a.max.isZero()
  return false
}
