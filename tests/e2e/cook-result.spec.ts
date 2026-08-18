import { expect, test } from '@playwright/test'

/**
 * Finishing a cook.
 *
 * The point of the screen is that a result stays meaningful after the recipe
 * moves on, so what these tests check is not only that the fields save but
 * that the record points at the version and scale actually cooked.
 */

async function cookThrough(page: import('@playwright/test').Page, slug: string, scale = '1') {
  await page.goto(`/ru/recipes/${slug}/cook?scale=${scale}`)

  // The pager always renders exactly one of these two, so waiting for the
  // Back button first is what proves the page is interactive; breaking the
  // loop on a missing Next button alone would break on a transient render.
  await expect(page.getByRole('button', { name: 'Назад' })).toBeVisible()

  const finish = page.getByRole('button', { name: 'Завершить' })
  for (let guard = 0; guard < 40 && !(await finish.isVisible()); guard += 1) {
    await page.getByRole('button', { name: 'Далее' }).click()
  }

  await finish.click()
  await expect(page.getByRole('heading', { name: 'Как получилось?' })).toBeVisible({
    timeout: 20_000,
  })
}

test.describe('recording how a cook went', () => {
  test('saves the ratings, the times and the note', async ({ page }) => {
    await cookThrough(page, 'sisofo-forgotten-neapolitan')

    await page.getByRole('button', { name: 'Общая оценка: 4' }).click()
    await page.getByRole('button', { name: 'Вкус: 5' }).click()
    await page.getByRole('button', { name: 'Корочка и структура: 3' }).click()
    await page.getByRole('button', { name: 'Удобство работы с тестом: 4' }).click()
    await page.getByLabel('Фактическая активная работа (мин)').fill('45')
    await page.getByLabel('Заметка').fill('Духовка не дотянула до 250.')
    await page.getByLabel('Что изменить в следующий раз').fill('Дольше прогревать камень.')

    await page.getByRole('button', { name: 'Сохранить результат' }).click()
    await expect(page.getByText('Результат сохранён.')).toBeVisible({ timeout: 20_000 })

    await page.goto('/ru/history')
    await expect(page.getByText('Духовка не дотянула до 250.')).toBeVisible()
    await expect(page.getByText('Дольше прогревать камень.')).toBeVisible()
    await expect(page.getByText('4/5').first()).toBeVisible()
  })

  test('records the scale the cook was actually run at', async ({ page }) => {
    await cookThrough(page, 'sisofo-forgotten-neapolitan', '2')

    await page.getByRole('button', { name: 'Сохранить результат' }).click()
    await expect(page.getByText('Результат сохранён.')).toBeVisible({ timeout: 20_000 })

    await page.goto('/ru/history')
    await expect(page.getByText('×2').first()).toBeVisible()
  })

  test('queues the result when there is no connection, then syncs it', async ({
    page,
    context,
  }) => {
    await cookThrough(page, 'sisofo-forgotten-neapolitan')

    await context.setOffline(true)
    await page.getByLabel('Заметка').fill('Записано без сети.')
    await page.getByRole('button', { name: 'Сохранить результат' }).click()

    // Labelled as queued, never as saved.
    await expect(page.getByText('Сохранено на этом устройстве')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('Результат сохранён.')).toHaveCount(0)

    await context.setOffline(false)
    await page.goto('/ru/history')
    await expect(page.getByText('Записано без сети.')).toBeVisible({ timeout: 30_000 })
  })

  test('replaying the queued result does not create a second record', async ({
    page,
    context,
  }) => {
    await cookThrough(page, 'sisofo-forgotten-neapolitan')

    await context.setOffline(true)
    await page.getByLabel('Заметка').fill('Одна готовка.')
    await page.getByRole('button', { name: 'Сохранить результат' }).click()
    await expect(page.getByText('Сохранено на этом устройстве')).toBeVisible({ timeout: 20_000 })

    await context.setOffline(false)
    await page.goto('/ru/history')
    await expect(page.getByText('Одна готовка.')).toHaveCount(1, { timeout: 30_000 })

    // A second visit replays nothing new, and the history stays at one entry.
    await page.reload()
    await expect(page.getByText('Одна готовка.')).toHaveCount(1)
  })
})
