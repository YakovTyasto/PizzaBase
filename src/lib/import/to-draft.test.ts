import { describe, expect, it } from 'vitest'
import { mockExtraction } from '@/lib/providers/mock'
import { validateDraft } from '@/lib/data/recipe-draft'
import { buildCatalog, idempotencyKeyFor, importToDraft, matchIngredient } from './to-draft'

const catalog = buildCatalog([
  { slug: 'flour-type-00', name: 'Type 00 flour', aliases: ['Мука тип 00', 'Farine type 00'] },
  { slug: 'mozzarella-fior-di-latte', name: 'Fior di latte', aliases: ['Моцарелла', 'Mozzarella'] },
  { slug: 'salt-sea', name: 'Sea salt', aliases: ['Морская соль'] },
  { slug: 'water', name: 'Water', aliases: ['Вода'] },
])

describe('matching an extracted ingredient to the catalog', () => {
  it('matches an exact name', () => {
    expect(matchIngredient('Sea salt', catalog).slug).toBe('salt-sea')
  })

  it('matches the same ingredient written in another language', () => {
    // The whole reason matching spans aliases: an import in Russian must not
    // create a second flour.
    expect(matchIngredient('Мука тип 00', catalog).slug).toBe('flour-type-00')
    expect(matchIngredient('Farine type 00', catalog).slug).toBe('flour-type-00')
  })

  it('ignores case and punctuation', () => {
    expect(matchIngredient('  SEA  SALT ', catalog).slug).toBe('salt-sea')
  })

  it('prefers the longest overlap', () => {
    expect(matchIngredient('type 00 flour', catalog).slug).toBe('flour-type-00')
  })

  it('leaves a genuinely unknown name unmatched rather than guessing', () => {
    const match = matchIngredient('Nduja', catalog)
    expect(match.slug).toBeNull()
    expect(match.confidence).toBe(0)
  })

  it('leaves an empty name unmatched', () => {
    expect(matchIngredient('   ', catalog).slug).toBeNull()
  })
})

describe('turning an approved candidate into a draft', () => {
  const extraction = mockExtraction({ text: 'x', hasTimecodes: true, sourceUrl: null })
  const resolved: Record<string, string> = {
    'Type 00 flour': 'flour-type-00',
    Water: 'water',
    Salt: 'salt-sea',
    'Active dry yeast': 'yeast-active-dry',
    'Olive oil': 'olive-oil-extra-virgin',
  }

  const draft = importToDraft({
    extraction,
    resolved,
    sourceUrl: 'https://www.youtube.com/watch?v=abc',
    locale: 'ru',
  })

  it('produces a draft the editor would accept', () => {
    expect(validateDraft(draft)).toEqual([])
  })

  it('never arrives verified, whatever the model claimed', () => {
    expect(draft.status).toBe('needs_review')
    expect(draft.authenticity).toBe('adapted')
    expect(draft.source?.credibilityTier).toBeLessThan(0.5)
  })

  it('keeps an unknown amount unknown', () => {
    const yeast = draft.items.find((item) => item.ingredientSlug === 'yeast-active-dry')
    expect(yeast?.amount).toEqual({ kind: 'unknown' })
  })

  it('keeps a disputed figure as a range instead of picking one end', () => {
    const salt = draft.items.find((item) => item.ingredientSlug === 'salt-sea')
    expect(salt?.amount).toEqual({ kind: 'range', min: '12', max: '15', unit: 'g' })
  })

  it('keeps "as needed" qualitative', () => {
    const oil = draft.items.find((item) => item.ingredientSlug === 'olive-oil-extra-virgin')
    expect(oil?.amount).toEqual({ kind: 'qualitative', unit: 'as_needed' })
    expect(oil?.optional).toBe(true)
  })

  it('records every reported conflict as something still to settle', () => {
    const conflicts = draft.evidence.filter((row) => row.reviewState === 'conflict')
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0]?.field).toBe('salt amount')
  })

  it('records the unknown amount as an open question with its timecode context', () => {
    const open = draft.evidence.filter((row) => row.reviewState === 'needs_review')
    expect(open).toHaveLength(1)
    expect(open[0]?.itemKey).toBe(
      draft.items.find((item) => item.ingredientSlug === 'yeast-active-dry')?.key,
    )
  })

  it('keeps the source attribution', () => {
    expect(draft.source?.sourceType).toBe('youtube')
    expect(draft.source?.url).toBe('https://www.youtube.com/watch?v=abc')
  })

  it('writes the title into the detected language, leaving the others to fall back', () => {
    expect(draft.originLocale).toBe('en')
    expect(draft.names.en).toBe('Sample dough from an imported source')
    expect(draft.names.ru).toBe('')
  })
})

describe('idempotency key', () => {
  const extraction = mockExtraction({ text: 'x', hasTimecodes: false, sourceUrl: null })

  it('is stable for the same candidate', () => {
    expect(idempotencyKeyFor(extraction, null)).toBe(idempotencyKeyFor(extraction, null))
  })

  it('separates two different sources of the same recipe', () => {
    expect(idempotencyKeyFor(extraction, 'https://a.test')).not.toBe(
      idempotencyKeyFor(extraction, 'https://b.test'),
    )
  })

  it('changes when an amount changes', () => {
    const edited = {
      ...extraction,
      ingredients: extraction.ingredients.map((ingredient, index) =>
        index === 0
          ? { ...ingredient, amount: { kind: 'exact' as const, value: '600', unit: 'g' as const } }
          : ingredient,
      ),
    }
    expect(idempotencyKeyFor(edited, null)).not.toBe(idempotencyKeyFor(extraction, null))
  })
})
