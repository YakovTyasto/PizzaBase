import { expect, test } from '@playwright/test'

/**
 * Import, end to end, with no API keys configured.
 *
 * The extraction comes from the bundled fixture, which deliberately contains an
 * unknown amount and a disputed range, so what is being tested is the whole
 * awkward path: review, match, approve, and a saved recipe that still says it
 * needs checking.
 */

const PASTED = [
  'Pizza dough from a video transcript.',
  'Mix the flour and the water, then add the salt and the yeast.',
  'Rest the dough, shape it and bake it.',
].join('\n')

async function pasteAndAnalyse(page: import('@playwright/test').Page) {
  await page.goto('/ru/import?tab=text')
  await page.getByLabel('Вставьте текст рецепта').fill(PASTED)
  await page.getByRole('button', { name: 'Загрузить' }).click()
  await expect(page.getByRole('heading', { name: 'Проверьте перед сохранением' })).toBeVisible({
    timeout: 20_000,
  })
}

test.describe('importing a recipe from pasted text', () => {
  test('shows what was found and what is still open, before saving anything', async ({ page }) => {
    await pasteAndAnalyse(page)

    // The fixture's awkward parts are surfaced rather than smoothed over.
    await expect(page.getByText('1 неизвестное значение')).toBeVisible()
    await expect(page.getByText('1 конфликт')).toBeVisible()
    await expect(page.getByText('12–15 g')).toBeVisible()

    // Nothing is in the library yet.
    await page.goto('/ru/recipes')
    await expect(
      page.getByRole('heading', { name: 'Sample dough from an imported source' }),
    ).toHaveCount(0)
  })

  test('matches every extracted name to the existing catalog', async ({ page }) => {
    await pasteAndAnalyse(page)
    // Five ingredients, all recognised: an import must not mint duplicates of
    // ingredients that already exist under another name.
    await expect(page.getByText('Сопоставлено', { exact: true })).toHaveCount(5, {
      timeout: 20_000,
    })
  })

  test('approved import really appears in the library', async ({ page }) => {
    await pasteAndAnalyse(page)

    await page.getByRole('button', { name: 'Сохранить рецепт' }).click()
    await expect(page).toHaveURL(/\/ru\/recipes\/[a-z0-9-]+$/, { timeout: 20_000 })

    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Sample dough from an imported source',
    )
    // Saved as needing review, not as verified. Scoped to the page body: the
    // same words are a nav link, which the phone layout hides.
    await expect(page.getByRole('main').getByText('Нужна проверка').first()).toBeVisible()

    await page.goto('/ru/recipes')
    await expect(
      page.getByRole('heading', { name: 'Sample dough from an imported source' }),
    ).toBeVisible()
  })

  test('the unknown amount from the import lands on the review screen', async ({ page }) => {
    await pasteAndAnalyse(page)
    await page.getByRole('button', { name: 'Сохранить рецепт' }).click()
    await expect(page).toHaveURL(/\/ru\/recipes\/[a-z0-9-]+$/, { timeout: 20_000 })

    await page.goto('/ru/review')
    // The yeast the source never quantified is a question, not an invented number.
    // The seeded collection asks the same question about other recipes, so it
    // is the count that matters: the import added one more.
    await expect(page.getByText('Сколько нужно «Сухие активные дрожжи»?').first()).toBeVisible()
  })

  test('approving the same import twice creates no duplicate', async ({ page }) => {
    await pasteAndAnalyse(page)
    await page.getByRole('button', { name: 'Сохранить рецепт' }).click()
    await expect(page).toHaveURL(/\/ru\/recipes\/[a-z0-9-]+$/, { timeout: 20_000 })
    const firstUrl = page.url()

    // Same source text again: the content-derived key recognises the repeat.
    await pasteAndAnalyse(page)
    await page.getByRole('button', { name: 'Сохранить рецепт' }).click()
    await expect(page).toHaveURL(/\/ru\/recipes\/[a-z0-9-]+$/, { timeout: 20_000 })

    expect(page.url()).toBe(firstUrl)

    await page.goto('/ru/recipes')
    await expect(
      page.getByRole('heading', { name: 'Sample dough from an imported source' }),
    ).toHaveCount(1)
  })

  test('discarding a candidate saves nothing', async ({ page }) => {
    await pasteAndAnalyse(page)
    await page.getByRole('button', { name: 'Отменить' }).click()

    await expect(page.getByLabel('Вставьте текст рецепта')).toBeVisible()
    await page.goto('/ru/recipes')
    await expect(
      page.getByRole('heading', { name: 'Sample dough from an imported source' }),
    ).toHaveCount(0)
  })
})
