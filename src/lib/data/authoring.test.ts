import { describe, expect, it } from 'vitest'
import { diffDrafts, doughSummaryOf } from './diff'
import { draftToStored, findComponentCycle, storedToDraft } from './draft-convert'
import {
  type RecipeDraft,
  recipeDraftSchema,
  slugify,
  uniqueSlug,
  validateDraft,
} from './recipe-draft'

function baseDraft(overrides: Partial<RecipeDraft> = {}): RecipeDraft {
  return recipeDraftSchema.parse({
    slug: 'test-sauce',
    type: 'sauce',
    status: 'draft',
    authenticity: 'user_verified',
    originLocale: 'ru',
    names: { ru: 'Соус', en: 'Sauce', fr: 'Sauce' },
    summaries: { ru: '', en: '', fr: '' },
    notes: { ru: '', en: '', fr: '' },
    items: [],
    steps: [],
    evidence: [],
    ...overrides,
  })
}

describe('draft validation', () => {
  it('accepts a minimal recipe', () => {
    expect(validateDraft(baseDraft())).toEqual([])
  })

  it('requires a name in the origin language, since that is the fallback', () => {
    const draft = baseDraft({ names: { ru: '', en: 'Sauce', fr: '' } })
    expect(validateDraft(draft).map((i) => i.path)).toContain('names.ru')
  })

  it('rejects an inverted range rather than silently swapping it', () => {
    const draft = baseDraft({
      items: [
        {
          key: 'salt',
          ingredientSlug: 'salt-sea',
          componentSlug: null,
          amount: { kind: 'range', min: '30', max: '20', unit: 'g' },
          optional: false,
          group: null,
        },
      ],
    })
    expect(validateDraft(draft).some((i) => /greater than/.test(i.message))).toBe(true)
  })

  it('rejects a non-numeric amount', () => {
    const draft = baseDraft({
      items: [
        {
          key: 'salt',
          ingredientSlug: 'salt-sea',
          componentSlug: null,
          amount: { kind: 'exact', value: 'a lot', unit: 'g' },
          optional: false,
          group: null,
        },
      ],
    })
    expect(validateDraft(draft).some((i) => /number/.test(i.message))).toBe(true)
  })

  it('accepts an unknown amount without complaint', () => {
    const draft = baseDraft({
      items: [
        {
          key: 'oil',
          ingredientSlug: 'olive-oil-extra-virgin',
          componentSlug: null,
          amount: { kind: 'unknown' },
          optional: false,
          group: null,
        },
      ],
    })
    // An amount the owner has not decided on is a valid state, not an error.
    expect(validateDraft(draft)).toEqual([])
  })

  it('rejects a line with both an ingredient and a component', () => {
    const parsed = recipeDraftSchema.safeParse({
      ...baseDraft(),
      items: [
        {
          key: 'x',
          ingredientSlug: 'salt-sea',
          componentSlug: 'tomato-sauce-user',
          amount: { kind: 'unknown' },
        },
      ],
    })
    expect(parsed.success).toBe(false)
  })

  it('rejects duplicate ingredient keys', () => {
    const item = {
      key: 'same',
      ingredientSlug: 'salt-sea',
      componentSlug: null,
      amount: { kind: 'unknown' as const },
      optional: false,
      group: null,
    }
    const draft = baseDraft({ items: [item, { ...item }] })
    expect(validateDraft(draft).some((i) => /Duplicate/.test(i.message))).toBe(true)
  })

  it('rejects a step referencing an ingredient that is not in the recipe', () => {
    const draft = baseDraft({
      steps: [
        {
          key: 'mix',
          phase: 'mix',
          activeMinutes: 5,
          waitMinMinutes: 0,
          waitMaxMinutes: 0,
          durationKnown: true,
          temperatureC: null,
          timerSeconds: null,
          itemKeys: ['nope'],
          instructions: { ru: 'Смешать', en: '', fr: '' },
        },
      ],
    })
    expect(validateDraft(draft).some((i) => /not an ingredient/.test(i.message))).toBe(true)
  })

  it('refuses to mark a recipe verified while a conflict is open', () => {
    const draft = baseDraft({
      status: 'verified',
      evidence: [
        {
          field: 'recipe.baseYield',
          itemKey: null,
          confidence: 0.2,
          reviewState: 'conflict',
          conflictGroup: 'yield',
          startSeconds: null,
          notes: { ru: 'Спор', en: '', fr: '' },
        },
      ],
    })
    expect(validateDraft(draft).map((i) => i.path)).toContain('status')
  })

  it('needs a unit whenever a yield is given', () => {
    const draft = baseDraft({ baseYield: '400', yieldUnit: null })
    expect(validateDraft(draft).map((i) => i.path)).toContain('yieldUnit')
  })
})

describe('slugs', () => {
  it('transliterates Cyrillic', () => {
    expect(slugify('Томатный соус')).toBe('tomatnyi-sous')
    expect(slugify('Мой соус!')).toBe('moi-sous')
  })

  it('strips Latin accents', () => {
    expect(slugify('Pâte à pizza')).toBe('pate-a-pizza')
  })

  it('avoids collisions', () => {
    const taken = new Set(['sauce', 'sauce-2'])
    expect(uniqueSlug('Sauce', taken)).toBe('sauce-3')
  })

  it('falls back when a name has no usable characters', () => {
    expect(uniqueSlug('!!!', new Set())).toBe('recipe')
  })
})

describe('draft round trip', () => {
  it('survives conversion to storage and back', () => {
    const draft = baseDraft({
      baseYield: '400',
      yieldUnit: 'g',
      items: [
        {
          key: 'tomatoes',
          ingredientSlug: 'tomatoes-whole-peeled-canned',
          componentSlug: null,
          amount: { kind: 'exact', value: '400', unit: 'g' },
          optional: false,
          group: null,
        },
        {
          key: 'salt',
          ingredientSlug: 'salt-sea',
          componentSlug: null,
          amount: { kind: 'qualitative', unit: 'to_taste' },
          optional: false,
          group: null,
        },
        {
          key: 'oil',
          ingredientSlug: 'olive-oil-extra-virgin',
          componentSlug: null,
          amount: { kind: 'unknown' },
          optional: true,
          group: null,
        },
      ],
    })

    const restored = storedToDraft(draftToStored(draft, 'test-sauce'))

    expect(restored.items.map((item) => item.amount)).toEqual([
      { kind: 'exact', value: '400', unit: 'g' },
      { kind: 'qualitative', unit: 'to_taste' },
      { kind: 'unknown' },
    ])
    expect(restored.baseYield).toBe('400')
    expect(restored.items[2]?.optional).toBe(true)
  })

  it('normalizes a decimal comma on the way to storage', () => {
    const draft = baseDraft({
      items: [
        {
          key: 'yeast',
          ingredientSlug: 'yeast-active-dry',
          componentSlug: null,
          amount: { kind: 'exact', value: '0,16', unit: 'g' },
          optional: false,
          group: null,
        },
      ],
    })
    const stored = draftToStored(draft, 'x')
    expect(stored.items[0]?.amount).toEqual({ kind: 'exact', value: '0.16', unit: 'g' })
  })
})

describe('component cycle detection', () => {
  it('catches a recipe that contains itself', () => {
    const draft = baseDraft({
      items: [
        {
          key: 'self',
          ingredientSlug: null,
          componentSlug: 'test-sauce',
          amount: { kind: 'exact', value: '10', unit: 'g' },
          optional: false,
          group: null,
        },
      ],
    })
    expect(findComponentCycle(draft, 'test-sauce', new Map())).not.toBeNull()
  })

  it('catches an indirect loop through an existing recipe', () => {
    const draft = baseDraft({
      items: [
        {
          key: 'other',
          ingredientSlug: null,
          componentSlug: 'pizza-a',
          amount: { kind: 'exact', value: '10', unit: 'g' },
          optional: false,
          group: null,
        },
      ],
    })
    // pizza-a already uses test-sauce, so adding pizza-a here closes the loop.
    const existing = new Map([['pizza-a', [{ componentSlug: 'test-sauce' }]]])
    expect(findComponentCycle(draft, 'test-sauce', existing)).not.toBeNull()
  })

  it('allows a legitimate nesting', () => {
    const draft = baseDraft({
      items: [
        {
          key: 'sauce',
          ingredientSlug: null,
          componentSlug: 'other-sauce',
          amount: { kind: 'exact', value: '80', unit: 'g' },
          optional: false,
          group: null,
        },
      ],
    })
    const existing = new Map([['other-sauce', [] as { componentSlug?: string | null }[]]])
    expect(findComponentCycle(draft, 'my-pizza', existing)).toBeNull()
  })
})

describe('version diff', () => {
  const before = baseDraft({
    baseYield: '400',
    yieldUnit: 'g',
    items: [
      {
        key: 'tomatoes',
        ingredientSlug: 'tomatoes-whole-peeled-canned',
        componentSlug: null,
        amount: { kind: 'exact', value: '400', unit: 'g' },
        optional: false,
        group: null,
      },
    ],
  })

  it('reports a changed quantity', () => {
    const after = baseDraft({
      baseYield: '400',
      yieldUnit: 'g',
      items: [
        {
          key: 'tomatoes',
          ingredientSlug: 'tomatoes-whole-peeled-canned',
          componentSlug: null,
          amount: { kind: 'exact', value: '500', unit: 'g' },
          optional: false,
          group: null,
        },
      ],
    })
    const diff = diffDrafts(before, after)
    const entry = diff.find((d) => d.group === 'ingredients')
    expect(entry?.kind).toBe('changed')
    expect(entry?.before).toBe('400 g')
    expect(entry?.after).toBe('500 g')
  })

  it('reports an added and a removed ingredient', () => {
    const after = baseDraft({
      baseYield: '400',
      yieldUnit: 'g',
      items: [
        {
          key: 'basil',
          ingredientSlug: 'basil-fresh',
          componentSlug: null,
          amount: { kind: 'qualitative', unit: 'to_taste' },
          optional: false,
          group: null,
        },
      ],
    })
    const diff = diffDrafts(before, after)
    expect(diff.some((d) => d.kind === 'removed')).toBe(true)
    expect(diff.some((d) => d.kind === 'added')).toBe(true)
  })

  it('reports a yield change', () => {
    const after = baseDraft({ baseYield: '600', yieldUnit: 'g' })
    const diff = diffDrafts(before, after)
    expect(diff.some((d) => d.label === 'baseYield' && d.after === '600')).toBe(true)
  })

  it('finds nothing between identical versions', () => {
    expect(diffDrafts(before, before)).toEqual([])
  })
})

describe('dough summary for comparison', () => {
  it("computes baker's percentages from the draft", () => {
    const dough = baseDraft({
      type: 'dough',
      items: [
        {
          key: 'flour',
          ingredientSlug: 'flour-type-00',
          componentSlug: null,
          amount: { kind: 'exact', value: '520', unit: 'g' },
          optional: false,
          group: null,
        },
        {
          key: 'water',
          ingredientSlug: 'water',
          componentSlug: null,
          amount: { kind: 'exact', value: '310', unit: 'g' },
          optional: false,
          group: null,
        },
        {
          key: 'salt',
          ingredientSlug: 'salt-sea',
          componentSlug: null,
          amount: { kind: 'exact', value: '13', unit: 'g' },
          optional: false,
          group: null,
        },
      ],
    })
    // The same 59.62% the source states.
    expect(doughSummaryOf(dough)?.hydration).toBe('59.62%')
    expect(doughSummaryOf(dough)?.salt).toBe('2.50%')
  })

  it('returns nothing without flour, rather than dividing by zero', () => {
    expect(doughSummaryOf(baseDraft({ type: 'dough' }))).toBeNull()
  })

  it('ignores non-dough recipes', () => {
    expect(doughSummaryOf(baseDraft())).toBeNull()
  })
})
