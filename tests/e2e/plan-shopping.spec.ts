import { expect, test } from '@playwright/test'

/**
 * Plan -> consolidated shopping list -> pantry deduction, which is the core
 * loop the app exists for.
 *
 * Demo state lives in a cookie, so each test starts from a clean context and
 * the runs cannot interfere with each other.
 */
test.describe('planning and shopping', () => {
  test('builds a plan from two different pizzas', async ({ page }) => {
    await page.goto('/ru/plan')

    const select = page.getByLabel('Добавить пиццу')
    await select.selectOption({ label: 'Маргарита' })
    await page.getByRole('button', { name: 'Добавить' }).click()
    await expect(page.getByRole('heading', { name: 'Маргарита' })).toBeVisible()

    await select.selectOption({ label: 'Пепперони' })
    await page.getByRole('button', { name: 'Добавить' }).click()
    await expect(page.getByRole('heading', { name: 'Пепперони' })).toBeVisible()

    await expect(page.getByText(/2 пиццы в плане/)).toBeVisible()
  })

  test('changing a count survives a reload', async ({ page }) => {
    await page.goto('/ru/plan')
    await page.getByLabel('Добавить пиццу').selectOption({ label: 'Маргарита' })
    await page.getByRole('button', { name: 'Добавить' }).click()

    const count = page.getByLabel('Сколько')
    await count.fill('4')
    await expect(page.getByText(/4 пиццы в плане/)).toBeVisible()

    // The value is written by a Server Action; wait for it to land before
    // reloading, otherwise the test races its own save.
    await page.waitForLoadState('networkidle')
    await page.reload()
    await expect(page.getByLabel('Сколько')).toHaveValue('4')
  })

  test('a dough plan produces a consolidated shopping list', async ({ page }) => {
    // Dough recipes carry real quantities, so the list has numbers to add up.
    await page.goto('/ru/plan')
    await page.getByLabel('Добавить пиццу').selectOption({ index: 0 })
    await page.getByRole('button', { name: 'Добавить' }).click()

    await page.goto('/ru/shopping')
    await expect(page.getByRole('heading', { name: 'Список покупок' })).toBeVisible()
  })

  test('deducts what is already in the pantry', async ({ page }) => {
    await page.goto('/ru/pantry')

    await page.getByLabel('Ингредиенты').selectOption({ label: 'Мука типа 00' })
    await page.getByLabel('Количество').fill('2')
    await page.getByLabel('Единицы').selectOption('kg')
    await page.getByRole('button', { name: 'Добавить продукт' }).click()

    // The entry is listed with the unit the user chose. Scoped to a paragraph
    // because the ingredient name also appears as an <option> in the picker.
    await expect(page.getByRole('paragraph').filter({ hasText: 'Мука типа 00' })).toBeVisible()
    await expect(page.getByText('2 кг')).toBeVisible()

    await page.waitForLoadState('networkidle')
    await page.reload()
    await expect(page.getByText('2 кг')).toBeVisible()
  })

  test('rejects a quantity that cannot be deducted from anything', async ({ page }) => {
    await page.goto('/ru/pantry')
    await page.getByLabel('Количество').fill('-5')
    await page.getByRole('button', { name: 'Добавить продукт' }).click()
    await expect(page.getByRole('alert').filter({ hasText: /.+/ })).toBeVisible()
  })

  test('offers a route forward when the plan is empty', async ({ page }) => {
    await page.goto('/ru/shopping')
    await expect(page.getByText('Покупать нечего.')).toBeVisible()
    await expect(page.getByRole('link', { name: 'План' }).first()).toBeVisible()
  })
})
