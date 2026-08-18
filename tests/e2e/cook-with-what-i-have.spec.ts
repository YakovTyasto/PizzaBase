import { expect, test } from '@playwright/test'

/**
 * "Cook with what I have".
 *
 * The defect: a recipe whose mandatory quantities were never stated came back
 * as 100% covered and offered itself as cookable, because an unstated amount
 * was skipped entirely and an empty denominator was read as "nothing missing".
 * The screen now has three answers where it used to have two.
 */

/**
 * Puts enough of the cheeses and tomatoes in the pantry to reach the pizzas.
 *
 * The ingredient is chosen by name rather than left at whatever happens to be
 * first: the default is fresh basil, which is counted in leaves, and a pantry
 * full of leaves reaches none of the recipes under test.
 */
const STOCKED = [
  'Моцарелла фиор ди латте',
  'Пармезан',
  'Целые очищенные томаты в собственном соку',
] as const

/**
 * Puts a known amount of three real ingredients in the pantry.
 *
 * Named rather than left at whatever sorts first -- the default is fresh basil,
 * counted in leaves, and a pantry full of leaves reaches none of the recipes.
 * Each row is confirmed before the next, so a write that did not land fails
 * here instead of turning into an empty recommendations screen later.
 */
async function stockThePantry(page: import('@playwright/test').Page) {
  await page.goto('/ru/pantry')
  await page.waitForLoadState('networkidle')

  for (const [index, name] of STOCKED.entries()) {
    await page.getByLabel('Ингредиенты', { exact: true }).selectOption({ label: name })
    await page.getByLabel('Количество').fill('900')
    await page.getByLabel('Единицы').selectOption('g')
    await page.getByRole('button', { name: 'Добавить' }).click()

    await expect(page.getByText('900 г')).toHaveCount(index + 1, { timeout: 15_000 })
  }
}

test.describe('the three states are distinguishable', () => {
  test('an incomplete recipe is not reported as cookable', async ({ page }) => {
    await stockThePantry(page)

    await page.goto('/ru/recommendations')
    await page.waitForLoadState('networkidle')

    // Every seeded pizza leaves at least one quantity unstated, and each of
    // them says so. There is nothing conditional about it: a stocked pantry
    // full of the right products still cannot make any of them cookable while
    // the recipes themselves do not say how much to use.
    const incomplete = page.getByRole('link', { name: 'Дополнить рецепт' })
    await expect(incomplete.first()).toBeVisible()
    const cards = await incomplete.count()
    expect(cards).toBeGreaterThan(0)

    // The third state never doubles as the first.
    await expect(page.getByText('Можно приготовить сейчас')).toHaveCount(0)
    // And coverage is reported as unknown rather than as a number it cannot know.
    await expect(page.getByText('Покрытие неизвестно').first()).toBeVisible()
  })

  test('names the ingredients whose quantity is missing', async ({ page }) => {
    await stockThePantry(page)

    await page.goto('/ru/recommendations')
    await page.waitForLoadState('networkidle')

    const incomplete = page.locator('li').filter({ hasText: 'Данных рецепта не хватает' }).first()
    await expect(incomplete).toBeVisible()

    // The point of the state: it says what is missing and offers the fix.
    await expect(incomplete).toContainText(/Не указано количество/)
    await expect(incomplete.getByRole('link', { name: 'Дополнить рецепт' })).toBeVisible()
  })

  test('an empty pantry offers no recipe as cookable', async ({ page }) => {
    await page.goto('/ru/recommendations')
    await page.waitForLoadState('networkidle')

    // With nothing in the pantry the screen asks for one rather than claiming
    // anything is ready to cook.
    const cookable = page.getByText('Можно приготовить сейчас')
    expect(await cookable.count()).toBe(0)
  })
})
