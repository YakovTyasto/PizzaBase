import { expect, test } from '@playwright/test'
import { pngFixture } from './fixtures/png'

/**
 * Reading a recipe out of a photograph, with no API key configured.
 *
 * The fixture stands in for the vision provider and is deliberately imperfect:
 * one quantity is cropped out of the frame and one word is ambiguous. What is
 * being tested is that both survive to the review screen as questions rather
 * than being filled in with something plausible.
 */

async function importPhoto(page: import('@playwright/test').Page) {
  await page.goto('/ru/import')

  // Switching tabs is a React onClick, so a selected Photo tab is proof the
  // page has hydrated. Filling the file input before that sets the file but
  // fires into a handler that is not attached yet.
  const photoTab = page.getByRole('tab', { name: 'Фото' })
  await photoTab.click()
  await expect(photoTab).toHaveAttribute('aria-selected', 'true')

  await page.getByLabel('Выбрать фото').setInputFiles(pngFixture('recipe-card.png', 200))
  await expect(page.getByRole('heading', { name: 'Проверьте перед сохранением' })).toBeVisible({
    timeout: 30_000,
  })
}

// Decoding, compressing and re-reading an image is real work; under a full
// parallel suite the default budget is tight rather than wrong.
test.describe.configure({ timeout: 60_000 })

test.describe('importing a recipe from a photo', () => {
  test('reads the card and keeps what it could not see as unknown', async ({ page }) => {
    await importPhoto(page)

    await expect(page.getByText('Tomato sauce from a recipe card')).toBeVisible()
    // Cropped out of the frame; it must not have been estimated.
    await expect(page.getByText('1 неизвестное значение')).toBeVisible()
    await expect(page.getByText('The amount is cut off at the edge of the photo.')).toBeVisible()
    await expect(page.getByText('1 конфликт')).toBeVisible()
  })

  test('names the provider so a fixture is never mistaken for a real read', async ({ page }) => {
    await page.goto('/ru/import?tab=photo')
    await expect(page.getByText(/OPENAI_API_KEY/).first()).toBeVisible()
  })

  test('saves the recipe through the same approval path', async ({ page }) => {
    await importPhoto(page)

    await page.getByRole('button', { name: 'Сохранить рецепт' }).click()
    await expect(page).toHaveURL(/\/ru\/recipes\/[a-z0-9-]+$/, { timeout: 30_000 })
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Tomato sauce from a recipe card',
    )

    await page.goto('/ru/recipes')
    await expect(
      page.getByRole('heading', { name: 'Tomato sauce from a recipe card' }),
    ).toHaveCount(1)
  })

  test('does not keep the photograph unless asked', async ({ page }) => {
    await importPhoto(page)

    const keep = page.getByLabel('Сохранить эту фотографию в рецепте')
    await expect(keep).not.toBeChecked()

    await page.getByRole('button', { name: 'Сохранить рецепт' }).click()
    await expect(page).toHaveURL(/\/ru\/recipes\/[a-z0-9-]+$/, { timeout: 30_000 })
    await expect(page.locator('article figure img')).toHaveCount(0)
  })

  test('keeps the photograph when the owner opts in', async ({ page }) => {
    await importPhoto(page)

    await page.getByLabel('Сохранить эту фотографию в рецепте').check()
    await page.getByRole('button', { name: 'Сохранить рецепт' }).click()
    await expect(page).toHaveURL(/\/ru\/recipes\/[a-z0-9-]+$/, { timeout: 30_000 })

    await expect(page.locator('article figure img').first()).toBeVisible({ timeout: 20_000 })
  })

  test('the same photo import twice creates one recipe', async ({ page }) => {
    await importPhoto(page)
    await page.getByRole('button', { name: 'Сохранить рецепт' }).click()
    await expect(page).toHaveURL(/\/ru\/recipes\/[a-z0-9-]+$/, { timeout: 30_000 })
    const first = page.url()

    await importPhoto(page)
    await page.getByRole('button', { name: 'Сохранить рецепт' }).click()
    await expect(page).toHaveURL(/\/ru\/recipes\/[a-z0-9-]+$/, { timeout: 30_000 })

    expect(page.url()).toBe(first)
    await page.goto('/ru/recipes')
    await expect(
      page.getByRole('heading', { name: 'Tomato sauce from a recipe card' }),
    ).toHaveCount(1)
  })
})
