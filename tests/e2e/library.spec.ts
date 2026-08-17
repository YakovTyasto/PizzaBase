import { expect, test } from '@playwright/test'

/**
 * Demo mode must be usable with no credentials at all -- that is the whole
 * point of it, and it is the state the README's first run leaves you in.
 */
test.describe('demo mode and the library', () => {
  test('opens without any external credentials', async ({ page }) => {
    await page.goto('/ru')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    // The badge is the app being honest about where its data comes from.
    await expect(page.getByText('Демо-режим')).toBeVisible()
  })

  test('lists the seeded recipes', async ({ page }) => {
    await page.goto('/ru/recipes')
    await expect(page.getByRole('heading', { name: 'Рецепты' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Маргарита' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Пепперони' })).toBeVisible()
  })

  test('finds an English recipe from a Russian query and back', async ({ page }) => {
    await page.goto('/en/recipes')
    const search = page.getByRole('searchbox')

    // A Russian ingredient alias must find English-authored recipes.
    await search.fill('моцарелла')
    await expect(
      page.getByRole('heading', { name: /Margherita|Mortadella|Four Cheese/ }).first(),
    ).toBeVisible({ timeout: 15_000 })
    await expect(page).toHaveURL(/q=/)

    // ...and a French alias finds the same catalog entry.
    await search.fill('roquette')
    await expect(page.getByRole('heading', { name: /Mortadella/ })).toBeVisible({
      timeout: 15_000,
    })
  })

  test('keeps filters in the URL so a view can be shared', async ({ page }) => {
    await page.goto('/ru/recipes?type=dough')
    await expect(page.getByRole('heading', { name: /тесто|Забытый|римск/i }).first()).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Маргарита' })).toHaveCount(0)
  })

  test('offers a way forward when nothing matches', async ({ page }) => {
    await page.goto('/ru/recipes?q=zzzznothingzzzz')
    await expect(page.getByText('Под эти фильтры ничего не подходит.')).toBeVisible()
    // An empty result must never invent a recipe to fill the space.
    await expect(page.getByRole('link', { name: /Импорт/ }).first()).toBeVisible()
  })

  test('has no horizontal overflow on a 390 px phone', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'Mobile layout check')

    for (const path of ['/ru', '/ru/recipes', '/ru/plan', '/ru/pantry', '/ru/settings']) {
      await page.goto(path)
      // Let fonts and the filter row settle; measuring mid-layout reports a
      // transient width that no user ever sees.
      await page.waitForLoadState('networkidle')

      const measured = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        widest: Array.from(document.querySelectorAll('*'))
          .map((el) => {
            const rect = el.getBoundingClientRect()
            return { tag: el.tagName, cls: String(el.className).slice(0, 60), right: rect.right }
          })
          .filter((entry) => entry.right > document.documentElement.clientWidth + 1)
          .slice(0, 3),
      }))

      expect(
        measured.scrollWidth,
        `${path} overflows horizontally: ${JSON.stringify(measured.widest)}`,
      ).toBeLessThanOrEqual(measured.clientWidth + 1)
    }
  })
})
