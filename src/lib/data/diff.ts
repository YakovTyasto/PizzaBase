import type { RecipeDraft } from './recipe-draft'

/**
 * Structural diff between two recipe versions.
 *
 * The comparison screen is about answering "what actually changed?", so this
 * reports field-level differences in the terms a baker cares about --
 * quantities, units, timings, temperatures -- rather than a text diff of JSON.
 */

export type DiffKind = 'added' | 'removed' | 'changed'

export interface DiffEntry {
  /** Grouping for the UI: which part of the recipe this belongs to. */
  group: 'general' | 'dough' | 'ingredients' | 'steps' | 'notes'
  /** Human-facing label key or literal field name. */
  label: string
  kind: DiffKind
  before: string | null
  after: string | null
}

function describeAmount(amount: RecipeDraft['items'][number]['amount']): string {
  switch (amount.kind) {
    case 'exact':
      return `${amount.value} ${amount.unit}`
    case 'range':
      return `${amount.min}–${amount.max} ${amount.unit}`
    case 'qualitative':
      return amount.unit
    case 'unknown':
      return '—'
  }
}

function pushScalar(
  entries: DiffEntry[],
  group: DiffEntry['group'],
  label: string,
  before: unknown,
  after: unknown,
) {
  const a = before === null || before === undefined || before === '' ? null : String(before)
  const b = after === null || after === undefined || after === '' ? null : String(after)
  if (a === b) return
  entries.push({
    group,
    label,
    kind: a === null ? 'added' : b === null ? 'removed' : 'changed',
    before: a,
    after: b,
  })
}

export function diffDrafts(before: RecipeDraft, after: RecipeDraft): DiffEntry[] {
  const entries: DiffEntry[] = []

  pushScalar(entries, 'general', 'status', before.status, after.status)
  pushScalar(entries, 'general', 'authenticity', before.authenticity, after.authenticity)
  pushScalar(entries, 'general', 'baseYield', before.baseYield, after.baseYield)
  pushScalar(entries, 'general', 'yieldUnit', before.yieldUnit, after.yieldUnit)
  pushScalar(entries, 'general', 'baseDiameterMm', before.baseDiameterMm, after.baseDiameterMm)
  pushScalar(entries, 'general', 'baseShape', before.baseShape, after.baseShape)
  pushScalar(entries, 'dough', 'baseBallWeightG', before.baseBallWeightG, after.baseBallWeightG)
  pushScalar(entries, 'general', 'activeMinutes', before.activeMinutes, after.activeMinutes)
  pushScalar(entries, 'general', 'passiveMinutes', before.passiveMinutes, after.passiveMinutes)

  for (const locale of ['ru', 'en', 'fr'] as const) {
    pushScalar(entries, 'notes', `name.${locale}`, before.names[locale], after.names[locale])
    pushScalar(entries, 'notes', `notes.${locale}`, before.notes[locale], after.notes[locale])
  }

  // Ingredients are matched by key, which is stable across an edit.
  const beforeItems = new Map(before.items.map((item) => [item.key, item]))
  const afterItems = new Map(after.items.map((item) => [item.key, item]))

  for (const [key, item] of beforeItems) {
    const next = afterItems.get(key)
    const label = item.ingredientSlug ?? item.componentSlug ?? key
    if (!next) {
      entries.push({
        group: 'ingredients',
        label,
        kind: 'removed',
        before: describeAmount(item.amount),
        after: null,
      })
      continue
    }
    const a = describeAmount(item.amount)
    const b = describeAmount(next.amount)
    if (a !== b) {
      entries.push({ group: 'ingredients', label, kind: 'changed', before: a, after: b })
    }
    if (item.optional !== next.optional) {
      entries.push({
        group: 'ingredients',
        label: `${label} (optional)`,
        kind: 'changed',
        before: String(item.optional),
        after: String(next.optional),
      })
    }
  }

  for (const [key, item] of afterItems) {
    if (beforeItems.has(key)) continue
    entries.push({
      group: 'ingredients',
      label: item.ingredientSlug ?? item.componentSlug ?? key,
      kind: 'added',
      before: null,
      after: describeAmount(item.amount),
    })
  }

  const beforeSteps = new Map(before.steps.map((step) => [step.key, step]))
  const afterSteps = new Map(after.steps.map((step) => [step.key, step]))

  for (const [key, step] of beforeSteps) {
    const next = afterSteps.get(key)
    if (!next) {
      entries.push({ group: 'steps', label: key, kind: 'removed', before: step.phase, after: null })
      continue
    }
    pushScalar(entries, 'steps', `${key}: phase`, step.phase, next.phase)
    pushScalar(entries, 'steps', `${key}: active`, step.activeMinutes, next.activeMinutes)
    pushScalar(entries, 'steps', `${key}: wait min`, step.waitMinMinutes, next.waitMinMinutes)
    pushScalar(entries, 'steps', `${key}: wait max`, step.waitMaxMinutes, next.waitMaxMinutes)
    pushScalar(entries, 'steps', `${key}: temperature`, step.temperatureC, next.temperatureC)
    for (const locale of ['ru', 'en', 'fr'] as const) {
      pushScalar(
        entries,
        'steps',
        `${key}: instruction (${locale})`,
        step.instructions[locale],
        next.instructions[locale],
      )
    }
  }

  for (const [key, step] of afterSteps) {
    if (beforeSteps.has(key)) continue
    entries.push({ group: 'steps', label: key, kind: 'added', before: null, after: step.phase })
  }

  return entries
}

/**
 * Baker's percentages are compared separately, because a change of 10 g of
 * water matters far more as a hydration shift than as a raw weight.
 */
export function doughSummaryOf(draft: RecipeDraft): Record<string, string> | null {
  if (draft.type !== 'dough') return null

  let flour = 0
  let water = 0
  let salt = 0
  let yeast = 0

  for (const item of draft.items) {
    if (item.amount.kind !== 'exact' || !item.ingredientSlug) continue
    const grams =
      item.amount.unit === 'kg'
        ? Number(item.amount.value.replace(',', '.')) * 1000
        : item.amount.unit === 'g'
          ? Number(item.amount.value.replace(',', '.'))
          : 0
    if (!Number.isFinite(grams)) continue

    if (item.ingredientSlug.startsWith('flour-')) flour += grams
    else if (item.ingredientSlug === 'water') water += grams
    else if (item.ingredientSlug.startsWith('salt-')) salt += grams
    else if (item.ingredientSlug.startsWith('yeast-')) yeast += grams
  }

  if (flour <= 0) return null
  const pct = (value: number) => `${((value / flour) * 100).toFixed(2)}%`
  return { hydration: pct(water), salt: pct(salt), yeast: pct(yeast) }
}
