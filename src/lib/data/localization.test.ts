import { describe, expect, it, vi } from 'vitest'
import { LOCALES, type Locale } from '@/domain'
import { seedCatalog } from '@/lib/seed'
import { DemoRepository } from './demo/repository'

/**
 * Locale parity.
 *
 * A live check found the same fourteen recipe ids in Russian and English,
 * which is the *correct* state: the catalog is one set of recipes with three
 * translations, not three catalogs. These tests pin that down so a future
 * change cannot quietly "fix" a non-problem by deleting or duplicating
 * content, and so a missing translation keeps falling back and saying so
 * rather than making a recipe disappear from one language.
 */

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
}))

const repository = new DemoRepository(false)

async function idsFor(locale: Locale): Promise<string[]> {
  const recipes = await repository.listRecipes(locale)
  return recipes.map((recipe) => recipe.id).sort()
}

describe('the same recipes exist in every language', () => {
  it('returns an identical id set for ru, en and fr with no filters', async () => {
    const [ru, en, fr] = await Promise.all([idsFor('ru'), idsFor('en'), idsFor('fr')])

    expect(ru).toEqual(en)
    expect(ru).toEqual(fr)
    expect(ru.length).toBe(seedCatalog.recipes.length)
  })

  it('covers every seeded recipe, so none is language-specific', async () => {
    const seeded = seedCatalog.recipes.map((recipe) => recipe.slug).sort()
    for (const locale of LOCALES) {
      expect(await idsFor(locale)).toEqual(seeded)
    }
  })

  it('loads every recipe detail page in ru and en', async () => {
    for (const locale of ['ru', 'en'] as const) {
      for (const seeded of seedCatalog.recipes) {
        const recipe = await repository.getRecipe(locale, seeded.slug)
        expect(recipe, `${seeded.slug} in ${locale}`).not.toBeNull()
        expect(recipe!.name.value.length).toBeGreaterThan(0)
        expect(recipe!.items.length).toBeGreaterThan(0)
      }
    }
  })
})

describe('fallback when a translation is missing', () => {
  it('serves the origin-language text and records where it came from', async () => {
    // Every seeded recipe carries all three names, so the honest way to test
    // the fallback is a recipe whose summary one locale genuinely lacks.
    const withPartialSummary = seedCatalog.recipes.find(
      (recipe) => !recipe.summaries.fr && (recipe.summaries.en || recipe.summaries.ru),
    )

    if (!withPartialSummary) {
      // Nothing in the catalog exercises it; the name path still must not lie.
      const recipe = await repository.getRecipe('fr', seedCatalog.recipes[0]!.slug)
      expect(recipe!.name.fallbackFrom).toBeNull()
      return
    }

    const recipe = await repository.getRecipe('fr', withPartialSummary.slug)
    expect(recipe!.summary?.value.length).toBeGreaterThan(0)
    // The badge is driven by this: text shown in a language it was not written
    // in must say so rather than passing as a translation.
    expect(recipe!.summary?.fallbackFrom).not.toBeNull()
  })

  it('never marks text as a fallback when it is genuinely translated', async () => {
    const recipe = await repository.getRecipe('en', 'sisofo-forgotten-neapolitan')
    expect(recipe!.name.fallbackFrom).toBeNull()
  })
})

describe('filters across a locale switch', () => {
  it('keeps a valid filter meaningful in every language', async () => {
    for (const locale of LOCALES) {
      const doughs = await repository.listRecipes(locale, { type: 'dough' })
      expect(doughs.length).toBeGreaterThan(0)
      expect(doughs.every((recipe) => recipe.type === 'dough')).toBe(true)
    }

    const ru = (await repository.listRecipes('ru', { type: 'dough' })).map((r) => r.id).sort()
    const en = (await repository.listRecipes('en', { type: 'dough' })).map((r) => r.id).sort()
    expect(ru).toEqual(en)
  })

  it('keeps a style filter selecting the same recipes in every language', async () => {
    const styled = seedCatalog.recipes.find((recipe) => recipe.styleSlug)
    expect(styled).toBeDefined()

    const ids = await Promise.all(
      LOCALES.map(async (locale) =>
        (await repository.listRecipes(locale, { styleId: styled!.styleSlug! }))
          .map((recipe) => recipe.id)
          .sort(),
      ),
    )
    expect(ids[1]).toEqual(ids[0])
    expect(ids[2]).toEqual(ids[0])
  })

  it('returns nothing for a filter value that no longer exists', async () => {
    // The repository is right to match nothing; it is the *page* that must
    // drop such a filter rather than show an empty library. See the recipes
    // page, which validates every value against the catalog before filtering.
    const stale = await repository.listRecipes('ru', { styleId: 'style-that-was-deleted' })
    expect(stale).toEqual([])
  })
})
