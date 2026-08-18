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

  // The 390 px overflow check lives in mobile-layout.spec.ts, which pins the
  // viewport itself so it runs in every project rather than being skipped.
})
