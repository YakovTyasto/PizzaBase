import { expect, test } from '@playwright/test'
import { pngFixture } from './fixtures/png'

/**
 * The whole product in one pass, at one width.
 *
 * Individual specs prove each feature; this proves they compose -- that a
 * sauce created in step two is really the one expanded in the shopping list in
 * step six, and that nothing in between loses the thread. It runs at every
 * viewport the suite covers, so a layout that only works on a desktop fails
 * here rather than in a kitchen.
 */

const WIDTHS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'desktop', width: 1280, height: 900 },
] as const

async function measureOverflow(page: import('@playwright/test').Page) {
  return page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    widest: Array.from(document.querySelectorAll('*'))
      .map((el) => ({
        tag: el.tagName,
        cls: String(el.className).slice(0, 60),
        right: el.getBoundingClientRect().right,
      }))
      .filter((entry) => entry.right > document.documentElement.clientWidth + 1)
      .slice(0, 3),
  }))
}

for (const size of WIDTHS) {
  test.describe(`the full journey at ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } })
    test.describe.configure({ timeout: 120_000 })

    test('sign in, author, plan, cook and compare without losing anything', async ({
      page,
      context,
    }) => {
      const noOverflow = async (where: string) => {
        await page.waitForLoadState('networkidle')
        const measured = await measureOverflow(page)
        expect(
          measured.scrollWidth,
          `${where} overflows: ${JSON.stringify(measured.widest)}`,
        ).toBeLessThanOrEqual(measured.clientWidth + 1)
      }

      // 1. Entry.
      await page.goto('/ru/login')
      await page.getByRole('button', { name: 'Войти в демо-режим' }).click()
      await expect(page).toHaveURL(/\/ru$/, { timeout: 20_000 })
      await noOverflow('home')

      // 2. A sauce with a photo, used as a component later.
      await page.goto('/ru/recipes/new?type=sauce')
      await page.getByLabel('Название').fill('Соус пути')
      await page.getByLabel('Выход').fill('400')
      await page.getByLabel('Единицы').selectOption('g')

      await page.getByRole('tab', { name: 'Ингредиенты' }).click()
      await page.getByRole('button', { name: 'Добавить ингредиент' }).click()
      await page
        .getByLabel('Ингредиенты', { exact: true })
        .last()
        .selectOption({ label: 'Целые очищенные томаты в собственном соку' })
      await page.getByLabel('Тип количества').last().selectOption('exact')
      await page.getByLabel('Количество').last().fill('400')

      await page.getByRole('tab', { name: 'Фотографии' }).click()
      await page.getByLabel('Добавить фотографии').setInputFiles(pngFixture('journey.png'))
      await expect(page.getByRole('button', { name: 'Обложка' })).toHaveCount(1, {
        timeout: 30_000,
      })
      await noOverflow('editor with a photo')

      await page.getByRole('button', { name: 'Создать рецепт' }).click()
      await expect(page).toHaveURL(/\/ru\/recipes\/[a-z0-9-]+$/, { timeout: 20_000 })
      await noOverflow('recipe detail')

      // 3. A pizza built on it.
      await page.goto('/ru/recipes/new?type=pizza')
      await page.getByLabel('Название').fill('Пицца пути')
      await page.getByRole('tab', { name: 'Ингредиенты' }).click()
      await page.getByRole('button', { name: 'Добавить вложенный рецепт' }).click()
      await page.getByLabel('Компоненты').last().selectOption({ label: 'Соус пути' })
      await page.getByLabel('Тип количества').last().selectOption('exact')
      await page.getByLabel('Количество').last().fill('200')
      await page.getByRole('button', { name: 'Создать рецепт' }).click()
      await expect(page).toHaveURL(/\/ru\/recipes\/[a-z0-9-]+$/, { timeout: 20_000 })

      // The component expanded rather than being listed opaquely.
      await expect(page.getByText('Целые очищенные томаты в собственном соку')).toBeVisible()

      // 4. Import a recipe from a photo, review it, save it.
      await page.goto('/ru/import')
      const photoTab = page.getByRole('tab', { name: 'Фото' })
      await photoTab.click()
      await expect(photoTab).toHaveAttribute('aria-selected', 'true')
      await page.getByLabel('Выбрать фото').setInputFiles(pngFixture('card.png', 200))
      await expect(page.getByRole('heading', { name: 'Проверьте перед сохранением' })).toBeVisible({
        timeout: 30_000,
      })
      await noOverflow('import review')
      await page.getByRole('button', { name: 'Сохранить рецепт' }).click()
      await expect(page).toHaveURL(/\/ru\/recipes\/[a-z0-9-]+$/, { timeout: 30_000 })

      // 5. Plan and shop.
      await page.goto('/ru/plan')
      await page.getByLabel('Добавить пиццу').selectOption({ label: 'Пицца пути' })
      await page.getByRole('button', { name: 'Добавить' }).click()
      await noOverflow('plan')

      await page.goto('/ru/shopping')
      // 200 g of a 400 g batch is half its tomatoes: the chain held.
      await expect(page.getByText('Целые очищенные томаты в собственном соку')).toBeVisible()
      await expect(page.getByText('200 г').first()).toBeVisible()
      await noOverflow('shopping')

      // 6. Cook it and record the result.
      await page.goto('/ru/recipes/sisofo-forgotten-neapolitan/cook')
      await expect(page.getByRole('button', { name: 'Назад' })).toBeVisible()
      const finish = page.getByRole('button', { name: 'Завершить' })
      for (let guard = 0; guard < 40 && !(await finish.isVisible()); guard += 1) {
        await page.getByRole('button', { name: 'Далее' }).click()
      }
      await finish.click()
      await expect(page.getByRole('heading', { name: 'Как получилось?' })).toBeVisible({
        timeout: 20_000,
      })
      await noOverflow('cook result')

      await page.getByRole('button', { name: 'Общая оценка: 4' }).click()
      await page.getByLabel('Заметка').fill('Путь пройден.')
      await page.getByRole('button', { name: 'Сохранить результат' }).click()
      await expect(page.getByText('Результат сохранён.')).toBeVisible({ timeout: 20_000 })

      await page.goto('/ru/history')
      await expect(page.getByText('Путь пройден.')).toBeVisible()
      await noOverflow('history')

      // 7. Offline, then back.
      await page.goto('/ru/recipes/new?type=sauce')
      await page.getByLabel('Название').fill('Соус без сети')
      await context.setOffline(true)
      await page.getByRole('button', { name: 'Создать рецепт' }).click()
      await expect(page.getByText('Сохранено на этом устройстве')).toBeVisible({ timeout: 20_000 })

      await context.setOffline(false)
      await page.goto('/ru/recipes')
      await expect(page.getByRole('heading', { name: 'Соус без сети' })).toHaveCount(1, {
        timeout: 30_000,
      })

      // Everything authored along the way is still here.
      await expect(page.getByRole('heading', { name: 'Соус пути' })).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Пицца пути' })).toBeVisible()
      await noOverflow('library at the end')
    })
  })
}
