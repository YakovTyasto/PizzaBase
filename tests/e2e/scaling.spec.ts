import { expect, test } from '@playwright/test'

/**
 * The deterministic engine, exercised through the UI.
 *
 * These assert the specific numbers the sources state, so a regression in the
 * arithmetic fails here and not just in the unit tests.
 */
test.describe('recipe scaling', () => {
  test('shows the stated formula and its baker\'s percentages', async ({ page }) => {
    await page.goto('/ru/recipes/sisofo-forgotten-neapolitan')

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Забытый стиль')

    // 520 g flour / 310 g water = 59.62% hydration, exactly as the source says.
    await expect(page.getByText('59,62')).toBeVisible()
    await expect(page.getByText('2,5', { exact: false }).first()).toBeVisible()
  })

  test('scales every ingredient when the batch changes', async ({ page }) => {
    await page.goto('/ru/recipes/sisofo-forgotten-neapolitan')

    const flourRow = page.locator('li').filter({ hasText: 'Мука типа 00' }).first()
    await expect(flourRow).toContainText('520')

    // Triple the balls: 520 g of flour becomes 1.04 kg.
    const count = page.getByLabel('Пиццы')
    await count.fill('9')

    await expect(flourRow).toContainText(/1,56|1 560/)
  })

  test('scales round toppings by area rather than by diameter', async ({ page }) => {
    await page.goto('/ru/recipes/pesto-bufala-user')
    // The owner's pizzas have unknown amounts, so the area control is what is
    // under test here rather than a specific gram figure.
    await expect(page.getByText('Считать топпинги по площади')).toBeVisible()
    await expect(
      page.getByText('Пицца 40 см имеет в 1,78 раза большую площадь'),
    ).toBeVisible()
  })

  test('says an amount is unknown instead of showing a zero', async ({ page }) => {
    await page.goto('/ru/recipes/margherita-user')
    // Every quantity the owner never stated must read as a question.
    await expect(page.getByText('Количество неизвестно').first()).toBeVisible()
    await expect(page.getByText('0 г')).toHaveCount(0)
  })

  test('explains why a component cannot be broken down', async ({ page }) => {
    await page.goto('/ru/recipes/margherita-user')
    // The tomato sauce has no yield until a can size is chosen, and the app
    // says exactly that rather than silently contributing nothing.
    await expect(page.getByText(/не задан выход/)).toBeVisible()
  })

  test('traces a nested ingredient back to the recipe that asked for it', async ({ page }) => {
    await page.goto('/ru/recipes/pesto-genovese-user')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Песто')
    // Pesto is a flat recipe, so its amounts come straight through. Exact
    // matching keeps these off the evidence note, which also contains "250 г".
    await expect(page.getByText('50 г', { exact: true })).toBeVisible()
    await expect(page.getByText('75 мл', { exact: true })).toBeVisible()
  })

  test('surfaces a source conflict rather than resolving it', async ({ page }) => {
    await page.goto('/ru/recipes/pesto-genovese-user')
    await expect(page.getByText('Конфликт').first()).toBeVisible()
    await expect(page.getByText(/150–170|150-170/)).toBeVisible()
  })

  test('keeps a disputed weight as a range', async ({ page }) => {
    await page.goto('/ru/recipes/iacopelli-poolish-double-fermentation')
    // Salt is reported as both 25 g and 30 g; neither is chosen for the user.
    await expect(page.getByText(/25–30|25-30/).first()).toBeVisible()
  })
})
