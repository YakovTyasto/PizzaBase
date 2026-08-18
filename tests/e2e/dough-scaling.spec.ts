import { expect, test } from '@playwright/test'

/**
 * Dough scaling through the UI, against the two formulas whose numbers are
 * known from their sources.
 *
 * The reported defect: Iacopelli's poolish formula states no ball count and no
 * ball weight, and a missing `baseYield` was being read as "the whole source
 * batch is one pizza". Asking for 3 x 250 g therefore multiplied the entire
 * 1.7 kg formula by three -- about 3 kg of flour and 2.1 kg of water -- while
 * the header still claimed a 750 g target. Changing the ball weight moved the
 * target and left the ingredients where they were.
 */

const ingredientSection = (page: import('@playwright/test').Page) =>
  page.locator('section').filter({ hasText: 'Ингредиенты' }).first()

/**
 * Reads a weight out of a row, in grams.
 *
 * Handles "129 г", "1,56 кг" and a range like "2,1–2,6 г", for which the
 * midpoint is taken -- the same nominal reference the domain uses.
 */
function gramsIn(text: string): number | null {
  const match = /(\d[\d   ]*(?:,\d+)?)(?:[–-](\d[\d   ]*(?:,\d+)?))?\s*(кг|г)(?![а-яё])/i.exec(text)
  if (!match) return null

  const num = (raw: string) => Number(raw.replace(/[\s  ]/g, '').replace(',', '.'))
  const low = num(match[1]!)
  const high = match[2] ? num(match[2]) : low
  if (!Number.isFinite(low) || !Number.isFinite(high)) return null

  const value = (low + high) / 2
  return match[3]!.toLowerCase() === 'кг' ? value * 1000 : value
}

/** Sums the ingredient rows only, never the totals block beneath them. */
async function ingredientTotalG(page: import('@playwright/test').Page): Promise<number> {
  const rows = await ingredientSection(page).locator('li').allInnerTexts()
  return rows.reduce((total, row) => total + (gramsIn(row) ?? 0), 0)
}

/** The weight shown for one named ingredient row, in grams. */
async function rowGrams(page: import('@playwright/test').Page, name: string): Promise<number[]> {
  const rows = await ingredientSection(page).locator('li').filter({ hasText: name }).allInnerTexts()
  return rows.flatMap((row) => {
    const grams = gramsIn(row)
    return grams === null ? [] : [grams]
  })
}

test.describe('a formula that states no yield', () => {
  test('scales 3 x 250 g to about 750 g, not to several kilograms', async ({ page }) => {
    await page.goto('/ru/recipes/iacopelli-poolish-double-fermentation')

    await page.getByLabel('Пиццы').fill('3')
    await page.getByLabel('Вес шара теста').fill('250')

    // The target the header states.
    await expect(page.getByText('750 г').first()).toBeVisible()

    // Flour is 1000 g of a 1748 g batch, so 750 g of dough needs about 429 g,
    // split across the poolish and the final dough.
    const flour = await rowGrams(page, 'Мука типа 00')
    expect(flour.reduce((sum, grams) => sum + grams, 0)).toBeCloseTo(429, 0)

    // The old behaviour put about 3 kg of flour and 2.1 kg of water here.
    await expect(ingredientSection(page)).not.toContainText('кг')

    const total = await ingredientTotalG(page)
    expect(total).toBeGreaterThan(735)
    expect(total).toBeLessThan(765)
  })

  test('changing the ball weight changes the ingredients, not just the target', async ({
    page,
  }) => {
    await page.goto('/ru/recipes/iacopelli-poolish-double-fermentation')

    await page.getByLabel('Пиццы').fill('3')
    await page.getByLabel('Вес шара теста').fill('250')
    const at250 = await ingredientTotalG(page)

    await page.getByLabel('Вес шара теста').fill('300')
    await expect(page.getByText('900 г').first()).toBeVisible()

    const at300 = await ingredientTotalG(page)
    expect(at300).toBeGreaterThan(885)
    expect(at300).toBeLessThan(915)
    // The whole point: the ingredients moved with the target.
    expect(at300).toBeGreaterThan(at250 * 1.15)
  })

  test('keeps a disputed weight as a range through the scaling', async ({ page }) => {
    await page.goto('/ru/recipes/iacopelli-poolish-double-fermentation')

    // Salt is reported as both 25 g and 30 g; neither is chosen for the user,
    // at any batch size.
    await page.getByLabel('Пиццы').fill('3')
    await page.getByLabel('Вес шара теста').fill('250')

    await expect(ingredientSection(page)).toContainText(/\d+(,\d+)?[–-]\d+(,\d+)?/)
  })
})

test.describe("baker's percentages for a disputed formula", () => {
  test('shows salt as 2,5–3% and yeast as 0,5–0,6%, never 0%', async ({ page }) => {
    await page.goto('/ru/recipes/iacopelli-poolish-double-fermentation')

    const percentages = page.locator('section').filter({ hasText: 'Пекарские проценты' }).first()
    await expect(percentages).toContainText(/2,5[–-]3\s*%/)
    await expect(percentages).toContainText(/0,5[–-]0,6\s*%/)
    await expect(percentages).toContainText('70')

    // The regression: both ranges used to be dropped and rendered as zero.
    const saltRow = percentages.locator('div').filter({ hasText: /^Соль/ }).first()
    await expect(saltRow).not.toContainText(/^0\s*%$/)
  })
})

test.describe('a formula with a stated yield still works', () => {
  test('gives about 843 g at the stated 3 x 281 g', async ({ page }) => {
    await page.goto('/ru/recipes/sisofo-forgotten-neapolitan')

    await expect(page.getByLabel('Пиццы')).toHaveValue('3')
    await expect(page.getByLabel('Вес шара теста')).toHaveValue('281')

    const total = await ingredientTotalG(page)
    expect(total).toBeGreaterThan(838)
    expect(total).toBeLessThan(848)
  })

  test('gives about 900 g at 3 x 300 g and moves every scalable ingredient', async ({ page }) => {
    await page.goto('/ru/recipes/sisofo-forgotten-neapolitan')

    const flourRow = page.locator('li').filter({ hasText: 'Мука типа 00' }).first()
    await expect(flourRow).toContainText('520')

    await page.getByLabel('Вес шара теста').fill('300')

    // 520 g of flour at 843 g of dough becomes about 555 g at 900 g.
    await expect(flourRow).toContainText('555')
    const total = await ingredientTotalG(page)
    expect(total).toBeGreaterThan(893)
    expect(total).toBeLessThan(907)
  })
})

test.describe('editable hydration', () => {
  test('changes flour and water while holding the target mass', async ({ page }) => {
    await page.goto('/ru/recipes/sisofo-forgotten-neapolitan')

    const hydration = page.getByLabel('Гидратация (%)')
    await expect(hydration).toHaveValue('59.6')

    const flourRow = page.locator('li').filter({ hasText: 'Мука типа 00' }).first()
    const waterRow = page.locator('li').filter({ hasText: /^Вода/ }).first()
    await expect(flourRow).toContainText('520')
    await expect(waterRow).toContainText('310')

    await hydration.fill('70')

    // Wetter dough at the same total: less flour, more water.
    // 843,156 g / (1 + 0,70 + 13,156/520) = 489 g of flour, and 70% of that.
    await expect(flourRow).toContainText('489')
    await expect(waterRow).toContainText('342')

    // The target is untouched, and the ingredients still add up to it.
    await expect(page.getByText('843 г').first()).toBeVisible()
    const total = await ingredientTotalG(page)
    expect(total).toBeGreaterThan(838)
    expect(total).toBeLessThan(848)

    // The percentage panel follows immediately.
    const percentages = page.locator('section').filter({ hasText: 'Пекарские проценты' }).first()
    await expect(percentages).toContainText('70')
  })

  test('rejects an implausible value without rewriting what was typed', async ({ page }) => {
    await page.goto('/ru/recipes/sisofo-forgotten-neapolitan')

    const hydration = page.getByLabel('Гидратация (%)')
    await hydration.fill('500')

    // The typed text survives; the app says what it will accept instead of
    // silently snapping the value back to a bound.
    await expect(hydration).toHaveValue('500')
    await expect(page.getByRole('alert').filter({ hasText: /30/ }).first()).toBeVisible()
  })

  test('restores the source hydration through the reset action', async ({ page }) => {
    await page.goto('/ru/recipes/sisofo-forgotten-neapolitan')

    const hydration = page.getByLabel('Гидратация (%)')
    await hydration.fill('75')
    await expect(page.locator('li').filter({ hasText: 'Мука типа 00' }).first()).not.toContainText(
      '520',
    )

    await page.getByRole('button', { name: 'Вернуть гидратацию источника' }).click()

    await expect(hydration).toHaveValue('59.6')
    await expect(page.locator('li').filter({ hasText: 'Мука типа 00' }).first()).toContainText(
      '520',
    )
  })

  test('is not offered for a recipe that is not a dough', async ({ page }) => {
    await page.goto('/ru/recipes/tomato-sauce-user')
    await expect(page.getByLabel('Гидратация (%)')).toHaveCount(0)
  })
})
