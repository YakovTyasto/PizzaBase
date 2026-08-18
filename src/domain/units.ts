import { Decimal } from 'decimal.js'

/**
 * A measure is a family of units. Conversion is only ever allowed *within* a
 * family, with the single documented exception of volume <-> mass, which
 * requires the density of one specific ingredient (see `convertWithDensity`).
 */
export type Measure = 'mass' | 'volume' | 'count' | 'package' | 'qualitative'

export const MASS_UNITS = ['mg', 'g', 'kg'] as const
export const VOLUME_UNITS = ['ml', 'l', 'tsp', 'tbsp'] as const
export const COUNT_UNITS = ['piece', 'clove', 'leaf', 'bunch'] as const
export const PACKAGE_UNITS = ['can', 'jar', 'bottle', 'pack', 'bag'] as const
export const QUALITATIVE_UNITS = ['pinch', 'handful', 'to_taste', 'as_needed'] as const

export type MassUnit = (typeof MASS_UNITS)[number]
export type VolumeUnit = (typeof VOLUME_UNITS)[number]
export type CountUnit = (typeof COUNT_UNITS)[number]
export type PackageUnit = (typeof PACKAGE_UNITS)[number]
export type QualitativeUnit = (typeof QUALITATIVE_UNITS)[number]
export type Unit = MassUnit | VolumeUnit | CountUnit | PackageUnit | QualitativeUnit

interface UnitDef {
  readonly measure: Measure
  /**
   * Factor to the canonical unit of the measure (g for mass, ml for volume).
   * `count` and `package` units are each their own dimension and therefore
   * carry no cross-unit factor.
   */
  readonly toCanonical?: string
}

/**
 * tsp/tbsp use the metric spoon definitions (5 ml / 15 ml) rather than the US
 * customary ones. Recipes in this app are metric-first; mixing definitions
 * silently is worse than picking one and documenting it.
 */
const UNITS: Record<Unit, UnitDef> = {
  mg: { measure: 'mass', toCanonical: '0.001' },
  g: { measure: 'mass', toCanonical: '1' },
  kg: { measure: 'mass', toCanonical: '1000' },

  ml: { measure: 'volume', toCanonical: '1' },
  l: { measure: 'volume', toCanonical: '1000' },
  tsp: { measure: 'volume', toCanonical: '5' },
  tbsp: { measure: 'volume', toCanonical: '15' },

  piece: { measure: 'count' },
  clove: { measure: 'count' },
  leaf: { measure: 'count' },
  bunch: { measure: 'count' },

  can: { measure: 'package' },
  jar: { measure: 'package' },
  bottle: { measure: 'package' },
  pack: { measure: 'package' },
  bag: { measure: 'package' },

  pinch: { measure: 'qualitative' },
  handful: { measure: 'qualitative' },
  to_taste: { measure: 'qualitative' },
  as_needed: { measure: 'qualitative' },
}

export const ALL_UNITS = Object.keys(UNITS) as Unit[]

export function isUnit(value: string): value is Unit {
  return Object.prototype.hasOwnProperty.call(UNITS, value)
}

export function measureOf(unit: Unit): Measure {
  return UNITS[unit].measure
}

export function isQualitativeUnit(unit: Unit): unit is QualitativeUnit {
  return UNITS[unit].measure === 'qualitative'
}

export function canonicalUnitFor(measure: Measure): Unit | null {
  if (measure === 'mass') return 'g'
  if (measure === 'volume') return 'ml'
  return null
}

/**
 * Two units are convertible when they share a measure that has a canonical
 * scale. `count` and `package` units only convert to themselves: a clove is not
 * a leaf, and a can is not a jar.
 */
export function areConvertible(from: Unit, to: Unit): boolean {
  if (from === to) return true
  const a = UNITS[from]
  const b = UNITS[to]
  if (a.measure !== b.measure) return false
  return a.toCanonical !== undefined && b.toCanonical !== undefined
}

export class UnitConversionError extends Error {
  constructor(
    message: string,
    readonly from: Unit,
    readonly to: Unit,
  ) {
    super(message)
    this.name = 'UnitConversionError'
  }
}

/** Convert a decimal value between two units of the same measure. */
export function convert(value: Decimal.Value, from: Unit, to: Unit): Decimal {
  if (from === to) return new Decimal(value)
  if (!areConvertible(from, to)) {
    throw new UnitConversionError(`Cannot convert ${from} to ${to}: incompatible units`, from, to)
  }
  const fromFactor = UNITS[from].toCanonical
  const toFactor = UNITS[to].toCanonical
  // areConvertible guarantees both factors exist.
  return new Decimal(value).times(fromFactor!).dividedBy(toFactor!)
}

/**
 * Volume <-> mass for one specific ingredient. `density` is g/ml and must come
 * from the ingredient record. There is no global default: 1 ml of olive oil is
 * 0.91 g and 1 ml of honey is 1.42 g, so assuming 1 g/ml would silently corrupt
 * every shopping list that mixes the two.
 */
export function convertWithDensity(
  value: Decimal.Value,
  from: Unit,
  to: Unit,
  density: Decimal.Value | null | undefined,
): Decimal {
  if (areConvertible(from, to)) return convert(value, from, to)

  const fromMeasure = measureOf(from)
  const toMeasure = measureOf(to)
  const crossesVolumeMass =
    (fromMeasure === 'volume' && toMeasure === 'mass') ||
    (fromMeasure === 'mass' && toMeasure === 'volume')

  if (!crossesVolumeMass) {
    throw new UnitConversionError(`Cannot convert ${from} to ${to}: incompatible units`, from, to)
  }
  if (density === null || density === undefined) {
    throw new UnitConversionError(
      `Cannot convert ${from} to ${to} without an ingredient density`,
      from,
      to,
    )
  }
  const d = new Decimal(density)
  if (d.lessThanOrEqualTo(0)) {
    throw new UnitConversionError(
      `Cannot convert ${from} to ${to}: density must be positive`,
      from,
      to,
    )
  }

  if (fromMeasure === 'volume') {
    const ml = convert(value, from, 'ml')
    return convert(ml.times(d), 'g', to)
  }
  const grams = convert(value, from, 'g')
  return convert(grams.dividedBy(d), 'ml', to)
}

/**
 * Picks the friendliest unit for displaying a canonical amount, e.g. 1500 g ->
 * 1.5 kg. Presentation only — never used inside calculations.
 */
export function preferredDisplayUnit(value: Decimal, unit: Unit): Unit {
  const abs = value.abs()
  if (unit === 'g' && abs.greaterThanOrEqualTo(1000)) return 'kg'
  if (unit === 'mg' && abs.greaterThanOrEqualTo(1000)) return 'g'
  if (unit === 'ml' && abs.greaterThanOrEqualTo(1000)) return 'l'
  if (unit === 'kg' && abs.lessThan(1)) return 'g'
  if (unit === 'l' && abs.lessThan(1)) return 'ml'
  return unit
}
