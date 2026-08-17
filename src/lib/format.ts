import type { Decimal } from 'decimal.js'
import { type Amount, type Unit, isQualitativeUnit, preferredDisplayUnit } from '@/domain'
import { convertAmount } from '@/domain'

/**
 * Presentation-layer formatting. Rounding happens *here* and nowhere earlier,
 * so accumulated precision is never lost mid-calculation.
 */

/** Significant decimals per unit: yeast needs two, flour needs none. */
function decimalsFor(unit: Unit, value: Decimal): number {
  const abs = value.abs()
  if (unit === 'kg' || unit === 'l') return abs.lessThan(1) ? 3 : 2
  if (unit === 'mg') return 0
  if (abs.lessThan(1)) return 2
  if (abs.lessThan(10)) return 1
  return 0
}

export function formatDecimal(value: Decimal, unit: Unit, locale: string): string {
  const places = decimalsFor(unit, value)
  const rounded = value.toDecimalPlaces(places)
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: places,
    minimumFractionDigits: 0,
  }).format(rounded.toNumber())
}

export interface FormattedAmount {
  /** The number(s), already localized. Null for qualitative and unknown. */
  value: string | null
  /** Unit code for looking up its localized label, or null. */
  unit: Unit | null
  /** Plural count to pass to the unit message. */
  count: number
  kind: Amount['kind']
}

/**
 * Prepares an amount for display, switching to a friendlier unit when that
 * reads better (1500 g becomes 1.5 kg). Qualitative and unknown amounts return
 * no number at all -- the caller shows the right words instead of a figure.
 */
export function formatAmount(amount: Amount, locale: string): FormattedAmount {
  if (amount.kind === 'unknown') return { value: null, unit: null, count: 0, kind: 'unknown' }
  if (amount.kind === 'qualitative') {
    return { value: null, unit: amount.unit, count: 1, kind: 'qualitative' }
  }

  if (amount.kind === 'exact') {
    const display = preferredDisplayUnit(amount.value, amount.unit)
    const converted = display === amount.unit ? amount : convertAmount(amount, display)
    const value = converted.kind === 'exact' ? converted.value : amount.value
    return {
      value: formatDecimal(value, display, locale),
      unit: display,
      count: value.toNumber(),
      kind: 'exact',
    }
  }

  // Ranges keep both bounds; collapsing to an average would invent precision.
  const display = preferredDisplayUnit(amount.max, amount.unit)
  const converted = display === amount.unit ? amount : convertAmount(amount, display)
  const min = converted.kind === 'range' ? converted.min : amount.min
  const max = converted.kind === 'range' ? converted.max : amount.max
  return {
    value: `${formatDecimal(min, display, locale)}–${formatDecimal(max, display, locale)}`,
    unit: display,
    count: max.toNumber(),
    kind: 'range',
  }
}

export function isQualitative(unit: Unit | null): boolean {
  return unit !== null && isQualitativeUnit(unit)
}

/** "1 h 45 min" style duration, using the locale's own words via messages. */
export function splitDuration(totalMinutes: number): { hours: number; minutes: number } {
  const safe = Math.max(0, Math.round(totalMinutes))
  return { hours: Math.floor(safe / 60), minutes: safe % 60 }
}

export function formatClock(date: Date, locale: string, timeZone?: string): string {
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    ...(timeZone ? { timeZone } : {}),
  }).format(date)
}

export function formatDateTime(date: Date, locale: string, timeZone?: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    ...(timeZone ? { timeZone } : {}),
  }).format(date)
}

export function formatDate(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

export function formatPercent(value: Decimal, locale: string, places = 1): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: places,
    minimumFractionDigits: 0,
  }).format(value.toDecimalPlaces(places).toNumber())
}

/** Celsius stays canonical; Fahrenheit is a display conversion only. */
export function formatTemperature(
  celsius: number,
  unit: 'c' | 'f',
  locale: string,
): string {
  const value = unit === 'f' ? celsius * (9 / 5) + 32 : celsius
  const formatted = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value)
  return `${formatted}°${unit.toUpperCase()}`
}

/**
 * Video timecode as "m:ss" or "h:mm:ss". Lives here rather than beside the
 * transcript provider so client components can use it without pulling a
 * `server-only` module into the browser bundle.
 */
export function formatTimecode(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60
  const pad = (value: number) => String(value).padStart(2, '0')
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${minutes}:${pad(secs)}`
}
