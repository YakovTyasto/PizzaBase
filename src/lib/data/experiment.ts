import { Decimal } from 'decimal.js'
import type { RecipeDraft } from './recipe-draft'

/**
 * Comparing versions as a baker would.
 *
 * Deliberately plain arithmetic. The interesting question -- "the crust was
 * better, what did I change?" -- is answered by putting hydration, salt,
 * yeast, preferment, fermentation, ball weight and temperature side by side,
 * and that is a table, not a judgement. Nothing here calls a model, and the
 * screen does not offer to summarise unless asked.
 */

export interface ParameterRow {
  key: string
  /** One value per version being compared, in the order they were given. */
  values: (string | null)[]
  /** True when the values are not all the same -- the rows worth reading. */
  changed: boolean
}

const FLOUR_PREFIX = 'flour-'
const YEAST_PREFIX = 'yeast-'
const SALT_PREFIX = 'salt-'
const PREFERMENT_GROUPS = ['poolish', 'biga', 'preferment', 'пулиш', 'бига']

function grams(amount: RecipeDraft['items'][number]['amount']): Decimal | null {
  if (amount.kind !== 'exact') return null
  const value = new Decimal(amount.value.replace(',', '.') || '0')
  if (amount.unit === 'kg') return value.times(1000)
  if (amount.unit === 'g') return value
  // Water is measured either way in practice and is 1 g/ml for this purpose;
  // anything else needs a density the domain engine owns, so it is skipped.
  if (amount.unit === 'ml') return value
  if (amount.unit === 'l') return value.times(1000)
  return null
}

interface Totals {
  flour: Decimal
  water: Decimal
  salt: Decimal
  yeast: Decimal
  prefermentFlour: Decimal
}

function totalsOf(draft: RecipeDraft): Totals {
  const totals: Totals = {
    flour: new Decimal(0),
    water: new Decimal(0),
    salt: new Decimal(0),
    yeast: new Decimal(0),
    prefermentFlour: new Decimal(0),
  }

  for (const item of draft.items) {
    const slug = item.ingredientSlug
    if (!slug) continue
    const mass = grams(item.amount)
    if (!mass) continue

    const inPreferment = PREFERMENT_GROUPS.some((group) =>
      (item.group ?? '').toLowerCase().includes(group),
    )

    if (slug.startsWith(FLOUR_PREFIX)) {
      totals.flour = totals.flour.plus(mass)
      if (inPreferment) totals.prefermentFlour = totals.prefermentFlour.plus(mass)
    } else if (slug === 'water') {
      totals.water = totals.water.plus(mass)
    } else if (slug.startsWith(SALT_PREFIX)) {
      totals.salt = totals.salt.plus(mass)
    } else if (slug.startsWith(YEAST_PREFIX)) {
      totals.yeast = totals.yeast.plus(mass)
    }
  }

  return totals
}

function percent(part: Decimal, whole: Decimal): string | null {
  if (whole.lessThanOrEqualTo(0)) return null
  return `${part.dividedBy(whole).times(100).toFixed(2)}%`
}

/** Total waiting time across every step, which is what "fermentation" means here. */
function fermentationMinutes(draft: RecipeDraft): number | null {
  const total = draft.steps.reduce((sum, step) => sum + (step.waitMaxMinutes ?? 0), 0)
  return total > 0 ? total : null
}

function peakTemperature(draft: RecipeDraft): string | null {
  const temperatures = draft.steps
    .map((step) => step.temperatureC)
    .filter((value): value is number => value !== null)
  return temperatures.length > 0 ? `${Math.max(...temperatures)} °C` : null
}

/** The one row per parameter that a comparison table is made of. */
export function compareDrafts(drafts: RecipeDraft[]): ParameterRow[] {
  const totals = drafts.map(totalsOf)

  const rows: ParameterRow[] = [
    row(
      'hydration',
      totals.map((t) => percent(t.water, t.flour)),
    ),
    row(
      'salt',
      totals.map((t) => percent(t.salt, t.flour)),
    ),
    row(
      'yeast',
      totals.map((t) => percent(t.yeast, t.flour)),
    ),
    row(
      'preferment',
      totals.map((t) => percent(t.prefermentFlour, t.flour)),
    ),
    row(
      'flour',
      totals.map((t) => (t.flour.greaterThan(0) ? `${t.flour.toFixed(0)} g` : null)),
    ),
    row(
      'fermentation',
      drafts.map((draft) => {
        const minutes = fermentationMinutes(draft)
        return minutes === null ? null : `${Math.round((minutes / 60) * 10) / 10} h`
      }),
    ),
    row(
      'ballWeight',
      drafts.map((draft) => (draft.baseBallWeightG ? `${draft.baseBallWeightG} g` : null)),
    ),
    row('temperature', drafts.map(peakTemperature)),
    row(
      'yield',
      drafts.map((draft) =>
        draft.baseYield ? `${draft.baseYield} ${draft.yieldUnit ?? ''}`.trim() : null,
      ),
    ),
  ]

  return rows
}

function row(key: string, values: (string | null)[]): ParameterRow {
  const first = values[0] ?? null
  return { key, values, changed: values.some((value) => (value ?? null) !== first) }
}

/** The rows that actually differ -- what the screen leads with. */
export function changedRows(rows: ParameterRow[]): ParameterRow[] {
  return rows.filter((entry) => entry.changed)
}
