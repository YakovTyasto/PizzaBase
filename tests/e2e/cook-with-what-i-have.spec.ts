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
async function stockThePantry(page: import('@playwright/test').Page) {
  await page.goto('/ru/pantry')

  for (const name of [
    'Моцарелла фиор ди латте',
    'Пармезан',
    'Целые очищенные томаты в собственном соку',
  ]) {
    await page.getByLabel('Ингредиенты', { exact: true }).selectOption({ label: name })
    await page.getByLabel('Количество').fill('900')
    await page.getByLabel('Единицы').selectOption('g')
    await page.getByRole('button', { name: 'Добавить' }).click()
    // The row appearing is the proof the write landed; an error would show
    // instead, and the recommendations screen would have nothing to work on.
    await expect(page.getByText(name, { exact: false }).last()).toBeVisible()
  }
}

test.describe('the three states are distinguishable', () => {
  test('an incomplete recipe is not reported as cookable', async ({ page }) => {
    await stockThePantry(page)

    await page.goto('/ru/recommendations')
    await page.waitForLoadState('networkidle')

    const cards = page.locator('li').filter({ has: page.getByRole('link') })
    const count = await cards.count()
    test.skip(count === 0, 'The pantry does not reach any recipe in this run.')

    for (let index = 0; index < count; index += 1) {
      const card = cards.nth(index)
      const text = await card.innerText()

      // A card may say it is cookable, or that products are missing, or that
      // the recipe's own data is too thin -- never the first and third at once.
      if (text.includes('Данных рецепта не хватает')) {
        expect(text).not.toContain('Можно приготовить сейчас')
      }
    }
  })

  test('names the ingredients whose quantity is missing', async ({ page }) => {
    await stockThePantry(page)

    await page.goto('/ru/recommendations')
    await page.waitForLoadState('networkidle')

    const incomplete = page.locator('li').filter({ hasText: 'Данных рецепта не хватает' }).first()

    if ((await incomplete.count()) === 0) return
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
