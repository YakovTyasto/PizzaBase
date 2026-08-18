import { describe, expect, it } from 'vitest'
import { changedRows, compareDrafts } from './experiment'
import { type RecipeDraft, recipeDraftSchema } from './recipe-draft'

function dough(overrides: Partial<RecipeDraft> = {}): RecipeDraft {
  return recipeDraftSchema.parse({
    slug: 'test-dough',
    type: 'dough',
    status: 'verified',
    authenticity: 'user_verified',
    originLocale: 'ru',
    names: { ru: 'Тесто', en: '', fr: '' },
    summaries: { ru: '', en: '', fr: '' },
    notes: { ru: '', en: '', fr: '' },
    items: [],
    steps: [],
    evidence: [],
    ...overrides,
  })
}

function item(slug: string, value: string, group: string | null = null) {
  return {
    key: `${slug}-${value}`,
    ingredientSlug: slug,
    componentSlug: null,
    amount: { kind: 'exact' as const, value, unit: 'g' as const },
    optional: false,
    group,
  }
}

describe('comparing two versions of a dough', () => {
  const before = dough({
    items: [item('flour-type-00', '1000'), item('water', '600'), item('salt-sea', '25')],
    baseBallWeightG: '250',
  })

  const after = dough({
    items: [item('flour-type-00', '1000'), item('water', '700'), item('salt-sea', '25')],
    baseBallWeightG: '280',
  })

  const rows = compareDrafts([before, after])

  it("reports hydration as a baker's percentage on each side", () => {
    const hydration = rows.find((row) => row.key === 'hydration')
    expect(hydration?.values).toEqual(['60.00%', '70.00%'])
    expect(hydration?.changed).toBe(true)
  })

  it('leaves an unchanged parameter marked unchanged', () => {
    expect(rows.find((row) => row.key === 'salt')?.changed).toBe(false)
    expect(rows.find((row) => row.key === 'salt')?.values).toEqual(['2.50%', '2.50%'])
  })

  it('notices the ball weight', () => {
    const ball = rows.find((row) => row.key === 'ballWeight')
    expect(ball?.values).toEqual(['250 g', '280 g'])
    expect(ball?.changed).toBe(true)
  })

  it('surfaces only what moved', () => {
    expect(changedRows(rows).map((row) => row.key)).toEqual(['hydration', 'ballWeight'])
  })
})

describe('parameters that need more than two ingredients', () => {
  it('counts preferment flour as a share of total flour', () => {
    const draft = dough({
      items: [
        item('flour-type-00', '300', 'poolish'),
        item('flour-type-00', '700'),
        item('water', '650'),
      ],
    })
    expect(compareDrafts([draft])[3]).toMatchObject({ key: 'preferment', values: ['30.00%'] })
  })

  it('recognises a Russian preferment group name', () => {
    const draft = dough({
      items: [item('flour-type-00', '200', 'Бига'), item('flour-type-00', '800')],
    })
    expect(compareDrafts([draft]).find((row) => row.key === 'preferment')?.values).toEqual([
      '20.00%',
    ])
  })

  it('adds up the waiting time as fermentation', () => {
    const draft = dough({
      steps: [
        {
          key: 'bulk',
          phase: 'bulk',
          activeMinutes: 0,
          waitMinMinutes: 60,
          waitMaxMinutes: 120,
          durationKnown: true,
          temperatureC: 20,
          timerSeconds: null,
          itemKeys: [],
          instructions: { ru: 'Ждать', en: '', fr: '' },
        },
        {
          key: 'proof',
          phase: 'cold_proof',
          activeMinutes: 0,
          waitMinMinutes: 60,
          waitMaxMinutes: 360,
          durationKnown: true,
          temperatureC: 4,
          timerSeconds: null,
          itemKeys: [],
          instructions: { ru: 'Ждать', en: '', fr: '' },
        },
      ],
    })
    expect(compareDrafts([draft]).find((row) => row.key === 'fermentation')?.values).toEqual([
      '8 h',
    ])
    // The hottest step, which is the one that characterises the bake.
    expect(compareDrafts([draft]).find((row) => row.key === 'temperature')?.values).toEqual([
      '20 °C',
    ])
  })

  it('reports nothing rather than zero when there is no flour', () => {
    const draft = dough({ items: [item('water', '600')] })
    expect(compareDrafts([draft]).find((row) => row.key === 'hydration')?.values).toEqual([null])
  })

  it('ignores a quantity nobody has settled yet', () => {
    const draft = dough({
      items: [
        item('flour-type-00', '1000'),
        {
          key: 'water-unknown',
          ingredientSlug: 'water',
          componentSlug: null,
          amount: { kind: 'unknown' as const },
          optional: false,
          group: null,
        },
      ],
    })
    // An unknown amount contributes nothing rather than being read as zero.
    expect(compareDrafts([draft]).find((row) => row.key === 'hydration')?.values).toEqual(['0.00%'])
  })

  it('compares more than two versions at once', () => {
    const rows = compareDrafts([
      dough({ items: [item('flour-type-00', '1000'), item('water', '600')] }),
      dough({ items: [item('flour-type-00', '1000'), item('water', '650')] }),
      dough({ items: [item('flour-type-00', '1000'), item('water', '700')] }),
    ])
    expect(rows.find((row) => row.key === 'hydration')?.values).toEqual([
      '60.00%',
      '65.00%',
      '70.00%',
    ])
  })
})
