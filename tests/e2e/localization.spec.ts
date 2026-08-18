import { expect, test } from '@playwright/test'

/**
 * Localization, pinned as it actually is.
 *
 * A clean live check found the same fourteen recipe ids in Russian and in
 * English, which is correct: one catalog, three translations. These tests exist
 * so nobody later "fixes" that by deleting or duplicating content, and so a
 * locale switch keeps you on the recipe you were reading.
 */

/** Recipe slugs on the library page, taken from the links themselves. */
async function slugsOn(page: import('@playwright/test').Page, locale: string): Promise<string[]> {
  await page.goto(`/${locale}/recipes`)
  await page.waitForLoadState('networkidle')

  const hrefs = await page
    .locator(`a[href^="/${locale}/recipes/"]`)
    .evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''))
  const slugs = hrefs
    .map((href) => href.split('/').pop() ?? '')
    .filter((slug) => slug && slug !== 'new')
  return [...new Set(slugs)].sort()
}

test.describe('every language holds the same recipes', () => {
  test('ru, en and fr return an identical id set with no filters', async ({ page }) => {
    const ru = await slugsOn(page, 'ru')
    const en = await slugsOn(page, 'en')
    const fr = await slugsOn(page, 'fr')

    expect(ru.length).toBeGreaterThanOrEqual(14)
    expect(en).toEqual(ru)
    expect(fr).toEqual(ru)
  })

  test('every seeded recipe page loads in ru and en', async ({ page }) => {
    const slugs = await slugsOn(page, 'ru')

    for (const slug of slugs) {
      for (const locale of ['ru', 'en'] as const) {
        const response = await page.goto(`/${locale}/recipes/${slug}`)
        expect(response?.status(), `${locale}/${slug}`).toBeLessThan(400)
        await expect(page.getByRole('heading', { level: 1 })).not.toBeEmpty()
      }
    }
  })
})

test.describe('switching language', () => {
  test('stays on the same recipe', async ({ page }) => {
    await page.goto('/ru/recipes/sisofo-forgotten-neapolitan')
    // The switcher is a group of buttons, one per locale.
    await page.getByRole('button', { name: 'Переключить на Английский' }).click()

    await expect(page).toHaveURL(/\/en\/recipes\/sisofo-forgotten-neapolitan/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Forgotten')
  })

  test('keeps a valid filter applied', async ({ page }) => {
    await page.goto('/ru/recipes?type=dough')
    const ruCount = await page.locator('a[href^="/ru/recipes/"]').count()

    await page.getByRole('button', { name: 'Переключить на Английский' }).click()
    await expect(page).toHaveURL(/\/en\/recipes\?.*type=dough/)
    await page.waitForLoadState('networkidle')

    // The same filter selects the same recipes, whatever they are called.
    await expect(page.locator('a[href^="/en/recipes/"]')).toHaveCount(ruCount)
  })
})

test.describe('a stale filter from an old link', () => {
  test('is cleared instead of hiding every recipe', async ({ page }) => {
    await page.goto('/ru/recipes?style=style-that-no-longer-exists')
    await page.waitForLoadState('networkidle')

    // The library is shown in full, and the dropped filter is called out.
    await expect(page.getByText(/фильтр/i).first()).toBeVisible()
    const slugs = await page
      .locator('a[href^="/ru/recipes/"]')
      .evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''))
    expect(slugs.filter((href) => !href.endsWith('/new')).length).toBeGreaterThan(0)
  })

  test('and an unrecognised type does the same', async ({ page }) => {
    await page.goto('/ru/recipes?type=not-a-type')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('Под эти фильтры ничего не подходит.')).toHaveCount(0)
  })
})
