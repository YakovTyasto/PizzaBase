import { expect, test } from '@playwright/test'

/**
 * The front door, and what happens when there is no signal.
 *
 * Demo mode gets an explicitly-labelled local entry; the magic-link form is
 * visible but plainly disabled, because a box that could not possibly work
 * would be worse than one that says so.
 */

test.describe('sign-in', () => {
  test('offers a labelled local entry in demo mode', async ({ page }) => {
    await page.goto('/ru/login')

    await expect(page.getByRole('heading', { name: 'Продолжить без аккаунта' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Войти в демо-режим' })).toBeEnabled()
  })

  test('does not pretend a magic link could be sent with no Supabase project', async ({ page }) => {
    await page.goto('/ru/login')

    await expect(page.getByLabel('Электронная почта')).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Прислать ссылку для входа' })).toBeDisabled()
    // And it names the missing key rather than failing silently.
    await expect(page.getByText(/NEXT_PUBLIC_SUPABASE_URL/)).toBeVisible()
  })

  test('returns to the page the visitor was heading for', async ({ page }) => {
    await page.goto('/ru/login?next=%2Fplan')
    await expect(page.getByText('После входа вы вернётесь на /plan.')).toBeVisible()

    await page.getByRole('button', { name: 'Войти в демо-режим' }).click()
    await expect(page).toHaveURL(/\/ru\/plan$/, { timeout: 20_000 })
  })

  test('ignores an off-site return address', async ({ page }) => {
    await page.goto('/ru/login?next=https%3A%2F%2Fevil.test')
    await page.getByRole('button', { name: 'Войти в демо-режим' }).click()
    await expect(page).toHaveURL(/127\.0\.0\.1|localhost/)
    await expect(page).not.toHaveURL(/evil\.test/)
  })

  test('entering demo mode gives writes somewhere to go', async ({ page }) => {
    await page.goto('/ru/login')
    await page.getByRole('button', { name: 'Войти в демо-режим' }).click()
    await expect(page).toHaveURL(/\/ru$/, { timeout: 20_000 })

    await page.goto('/ru/recipes/new?type=sauce')
    await page.getByLabel('Название').fill('Соус после входа')
    await page.getByRole('button', { name: 'Создать рецепт' }).click()
    await expect(page).toHaveURL(/\/ru\/recipes\/[a-z0-9-]+$/, { timeout: 20_000 })
  })
})

test.describe('saving with no connection', () => {
  test('queues a draft instead of claiming it was saved, then syncs', async ({ page, context }) => {
    await page.goto('/ru/recipes/new?type=sauce')
    await page.getByLabel('Название').fill('Офлайн соус')
    await page.getByLabel('Выход').fill('400')
    await page.getByLabel('Единицы').selectOption('g')

    await context.setOffline(true)
    await page.getByRole('button', { name: 'Создать рецепт' }).click()

    // Queued, and labelled as queued -- not as saved.
    await expect(page.getByText('Сохранено на этом устройстве')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('Сохранено', { exact: true })).toHaveCount(0)
    await expect(page.getByText('1 изменение в очереди')).toBeVisible()

    // Coming back online replays it without being asked.
    await context.setOffline(false)
    await expect(page.getByText('1 изменение в очереди')).toHaveCount(0, { timeout: 30_000 })

    await page.goto('/ru/recipes')
    await expect(page.getByRole('heading', { name: 'Офлайн соус' })).toBeVisible()
  })

  test('an offline draft survives a reload and syncs on the next visit', async ({
    page,
    context,
  }) => {
    await page.goto('/ru/recipes/new?type=sauce')
    await page.getByLabel('Название').fill('Переживший перезагрузку')

    await context.setOffline(true)
    await page.getByRole('button', { name: 'Создать рецепт' }).click()
    await expect(page.getByText('Сохранено на этом устройстве')).toBeVisible({ timeout: 20_000 })

    // The queue lives in local storage, so navigating away does not lose it --
    // and leaving mid-replay must not produce the recipe twice, which is what
    // the idempotency key is for.
    await context.setOffline(false)
    await page.goto('/ru/recipes')

    await expect(page.getByRole('heading', { name: 'Переживший перезагрузку' })).toHaveCount(1, {
      timeout: 30_000,
    })

    await page.reload()
    await expect(page.getByRole('heading', { name: 'Переживший перезагрузку' })).toHaveCount(1)
  })

  test('the offline page explains what still works', async ({ page }) => {
    await page.goto('/ru/offline')
    await expect(page.getByText('Вы офлайн')).toBeVisible()
    await expect(page.getByText(/сессия готовки работают/)).toBeVisible()
  })
})
