import { expect, test } from '@playwright/test'

/**
 * The 390 px check, for every screen.
 *
 * The viewport is pinned in the file rather than left to the project, so this
 * runs in both projects instead of being skipped in one of them. A phone-width
 * layout is a property of the CSS, not of which browser profile happens to be
 * selected, and a check that only ever runs half the time is not a check.
 */
test.use({ viewport: { width: 390, height: 844 } })

/** Screens reachable with no data of one's own. */
const STATIC_PATHS = [
  '/ru',
  '/ru/recipes',
  '/ru/plan',
  '/ru/shopping',
  '/ru/pantry',
  '/ru/settings',
  '/ru/import',
  '/ru/review',
  '/ru/login',
  '/ru/recommendations',
  '/ru/history',
  '/ru/experiments',
  '/ru/scan',
  '/ru/import?tab=photo',
  '/ru/recipes/new?type=sauce',
  '/ru/recipes/margherita',
  '/ru/recipes/margherita/edit',
  '/ru/recipes/margherita/versions',
  '/ru/recipes/margherita/planner',
  '/ru/recipes/margherita/cook',
]

async function measure(page: import('@playwright/test').Page) {
  return page.evaluate(() => ({
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
}

test.describe('phone layout', () => {
  for (const path of STATIC_PATHS) {
    test(`has no horizontal overflow on ${path}`, async ({ page }) => {
      await page.goto(path)
      // Let fonts and any scrollable row settle; measuring mid-layout reports a
      // transient width no user ever sees.
      await page.waitForLoadState('networkidle')

      const measured = await measure(page)
      expect(
        measured.scrollWidth,
        `${path} overflows horizontally: ${JSON.stringify(measured.widest)}`,
      ).toBeLessThanOrEqual(measured.clientWidth + 1)
    })
  }

  test('the editor stays within the viewport with a full ingredient list', async ({ page }) => {
    await page.goto('/ru/recipes/new?type=pizza')
    await page.getByLabel('Название').fill('Очень длинное название пиццы для проверки вёрстки')

    await page.getByRole('tab', { name: 'Ингредиенты' }).click()
    for (const label of [
      'Целые очищенные томаты в собственном соку',
      'Моцарелла фиор ди латте',
      'Оливковое масло extra virgin',
    ]) {
      await page.getByRole('button', { name: 'Добавить ингредиент' }).click()
      await page.getByLabel('Ингредиенты', { exact: true }).last().selectOption({ label })
      await page.getByLabel('Тип количества').last().selectOption('exact')
      await page.getByLabel('Количество').last().fill('120')
    }

    await page.getByRole('tab', { name: 'Шаги' }).click()
    await page.getByRole('button', { name: 'Добавить шаг' }).click()

    const measured = await measure(page)
    expect(
      measured.scrollWidth,
      `the editor overflows: ${JSON.stringify(measured.widest)}`,
    ).toBeLessThanOrEqual(measured.clientWidth + 1)
  })

  test('the comparison screen fits once there is something to compare', async ({ page }) => {
    await page.goto('/ru/recipes/new?type=sauce')
    await page.getByLabel('Название').fill('Соус для сравнения на телефоне')
    await page.getByLabel('Выход').fill('400')
    await page.getByLabel('Единицы').selectOption('g')
    await page.getByLabel('Статус').selectOption('verified')
    await page.getByRole('tab', { name: 'Ингредиенты' }).click()
    await page.getByRole('button', { name: 'Добавить ингредиент' }).click()
    await page
      .getByLabel('Ингредиенты', { exact: true })
      .last()
      .selectOption({ label: 'Целые очищенные томаты в собственном соку' })
    await page.getByLabel('Тип количества').last().selectOption('exact')
    await page.getByLabel('Количество').last().fill('400')
    await page.getByRole('button', { name: 'Создать рецепт' }).click()
    await expect(page).toHaveURL(/\/ru\/recipes\/[a-z0-9-]+$/, { timeout: 20_000 })
    const url = page.url()

    await page.goto(`${url}/edit`)
    await page.getByRole('tab', { name: 'Ингредиенты' }).click()
    await page.getByLabel('Количество').last().fill('500')
    await page.getByRole('button', { name: 'Сохранить' }).click()
    await expect(page).toHaveURL(/\/ru\/recipes\/[a-z0-9-]+$/, { timeout: 20_000 })

    await page.goto(`${url}/versions`)
    await page.waitForLoadState('networkidle')

    const measured = await measure(page)
    expect(
      measured.scrollWidth,
      `the comparison overflows: ${JSON.stringify(measured.widest)}`,
    ).toBeLessThanOrEqual(measured.clientWidth + 1)
  })
})
