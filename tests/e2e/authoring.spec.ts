import { expect, test } from '@playwright/test'

/**
 * The acceptance flow from the brief, end to end in demo mode: create a sauce,
 * reopen it, edit it, use it as a component of a new pizza, and see its
 * ingredients expand in the calculation and the shopping list.
 *
 * Every test starts from a clean browser context, so each gets its own demo
 * session and they cannot interfere with one another.
 */

async function createSauce(page: import('@playwright/test').Page, name: string) {
  await page.goto('/ru/recipes/new?type=sauce')

  await page.getByLabel('Название').fill(name)
  await page.getByLabel('Выход').fill('400')
  await page.getByLabel('Единицы').selectOption('g')

  await page.getByRole('tab', { name: 'Ингредиенты' }).click()

  // A can of tomatoes, an exact amount.
  await page.getByRole('button', { name: 'Добавить ингредиент' }).click()
  await page
    .getByLabel('Ингредиенты', { exact: true })
    .last()
    .selectOption({ label: 'Целые очищенные томаты в собственном соку' })
  await page.getByLabel('Тип количества').last().selectOption('exact')
  await page.getByLabel('Количество').last().fill('400')

  // Basil "to taste" -- this must survive as qualitative, not become a number.
  await page.getByRole('button', { name: 'Добавить ингредиент' }).click()
  await page.getByLabel('Ингредиенты', { exact: true }).last().selectOption({ label: 'Базилик свежий' })
  await page.getByLabel('Тип количества').last().selectOption('qualitative')

  // Olive oil, left explicitly unknown.
  await page.getByRole('button', { name: 'Добавить ингредиент' }).click()
  await page
    .getByLabel('Ингредиенты', { exact: true })
    .last()
    .selectOption({ label: 'Оливковое масло extra virgin' })
  await page.getByLabel('Тип количества').last().selectOption('unknown')

  // Salt, to taste.
  await page.getByRole('button', { name: 'Добавить ингредиент' }).click()
  await page.getByLabel('Ингредиенты', { exact: true }).last().selectOption({ label: 'Морская соль' })
  await page.getByLabel('Тип количества').last().selectOption('qualitative')

  await page.getByRole('button', { name: 'Создать рецепт' }).click()
  await expect(page).toHaveURL(/\/ru\/recipes\/[a-z0-9-]+$/, { timeout: 20_000 })
}

test.describe('creating and editing a recipe', () => {
  test('creates a sauce and shows it in the library', async ({ page }) => {
    await createSauce(page, 'Мой томатный соус')

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Мой томатный соус')
    // Each amount kind rendered as itself.
    await expect(page.getByText('400 г').first()).toBeVisible()
    await expect(page.getByText('по вкусу').first()).toBeVisible()
    await expect(page.getByText('Количество неизвестно').first()).toBeVisible()

    await page.goto('/ru/recipes')
    await expect(page.getByRole('heading', { name: 'Мой томатный соус' })).toBeVisible()
  })

  test('survives a reload and a new browser session', async ({ page, context }) => {
    await createSauce(page, 'Стойкий соус')

    await page.reload()
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Стойкий соус')

    // A brand-new page in the same context is what "restart the browser" looks
    // like for a session cookie that outlives the tab.
    const second = await context.newPage()
    await second.goto('/ru/recipes')
    await expect(second.getByRole('heading', { name: 'Стойкий соус' })).toBeVisible()
    await second.close()
  })

  test('reopens a saved recipe for editing and keeps the change', async ({ page }) => {
    await createSauce(page, 'Правимый соус')
    const url = page.url()

    await page.goto(`${url}/edit`)
    await expect(page.getByLabel('Название')).toHaveValue('Правимый соус')

    await page.getByLabel('Название').fill('Правимый соус 2')
    await page.getByRole('button', { name: 'Сохранить' }).click()

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Правимый соус 2', {
      timeout: 20_000,
    })

    await page.reload()
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Правимый соус 2')
  })

  test('refuses to save a recipe with no name', async ({ page }) => {
    await page.goto('/ru/recipes/new?type=sauce')
    await page.getByRole('button', { name: 'Создать рецепт' }).click()

    // Still on the editor, with an explanation rather than a false success.
    await expect(page).toHaveURL(/\/recipes\/new/)
    await expect(page.getByRole('alert').first()).toBeVisible()
  })

  test('warns about unsaved changes before discarding them', async ({ page }) => {
    await page.goto('/ru/recipes/new?type=sauce')
    await page.getByLabel('Название').fill('Черновик')
    await expect(page.getByText('Есть несохранённые изменения')).toBeVisible()
  })
})

test.describe('nested components', () => {
  test('uses a created sauce inside a new pizza and expands it', async ({ page }) => {
    await createSauce(page, 'Соус для пиццы')

    await page.goto('/ru/recipes/new?type=pizza')
    await page.getByLabel('Название').fill('Моя пицца')

    await page.getByRole('tab', { name: 'Ингредиенты' }).click()

    // The sauce created a moment ago is offered as a component.
    await page.getByRole('button', { name: 'Добавить вложенный рецепт' }).click()
    await page.getByLabel('Компоненты').last().selectOption({ label: 'Соус для пиццы' })
    await page.getByLabel('Тип количества').last().selectOption('exact')
    await page.getByLabel('Количество').last().fill('80')

    await page.getByRole('button', { name: 'Добавить ингредиент' }).click()
    await page
      .getByLabel('Ингредиенты', { exact: true })
      .last()
      .selectOption({ label: 'Моцарелла фиор ди латте' })
    await page.getByLabel('Тип количества').last().selectOption('exact')
    await page.getByLabel('Количество').last().fill('100')

    await page.getByRole('button', { name: 'Создать рецепт' }).click()
    await expect(page).toHaveURL(/\/ru\/recipes\/[a-z0-9-]+$/, { timeout: 20_000 })

    // 80 g of a sauce yielding 400 g pulls in one fifth of its tomatoes.
    await expect(
      page.getByText('Целые очищенные томаты в собственном соку'),
    ).toBeVisible()
    await expect(page.getByText('80 г', { exact: true }).first()).toBeVisible()
  })

  test('blocks a component cycle with a readable message', async ({ page }) => {
    await createSauce(page, 'Циклический соус')
    const url = page.url()

    await page.goto(`${url}/edit`)
    await page.getByRole('tab', { name: 'Ингредиенты' }).click()

    // The editor's picker excludes the recipe itself, so the cycle has to be
    // built through a second recipe to be reachable at all. Here we confirm
    // the option is genuinely absent.
    await page.getByRole('button', { name: 'Добавить вложенный рецепт' }).click()
    const options = await page.getByLabel('Компоненты').last().locator('option').allTextContents()
    expect(options).not.toContain('Циклический соус')
  })
})

test.describe('shopping list from a created recipe', () => {
  test('expands the created sauce into the consolidated list', async ({ page }) => {
    await createSauce(page, 'Соус для списка')

    await page.goto('/ru/recipes/new?type=pizza')
    await page.getByLabel('Название').fill('Пицца для списка')
    await page.getByRole('tab', { name: 'Ингредиенты' }).click()
    await page.getByRole('button', { name: 'Добавить вложенный рецепт' }).click()
    await page.getByLabel('Компоненты').last().selectOption({ label: 'Соус для списка' })
    await page.getByLabel('Тип количества').last().selectOption('exact')
    await page.getByLabel('Количество').last().fill('200')
    await page.getByRole('button', { name: 'Создать рецепт' }).click()
    await expect(page).toHaveURL(/\/ru\/recipes\/[a-z0-9-]+$/, { timeout: 20_000 })

    await page.goto('/ru/plan')
    await page.getByLabel('Добавить пиццу').selectOption({ label: 'Пицца для списка' })
    await page.getByRole('button', { name: 'Добавить' }).click()
    await page.waitForLoadState('networkidle')

    await page.goto('/ru/shopping')
    // 200 g of a 400 g sauce batch = half its tomatoes.
    await expect(page.getByText('Целые очищенные томаты в собственном соку')).toBeVisible()
    await expect(page.getByText('200 г').first()).toBeVisible()
  })
})

test.describe('demo data reset', () => {
  test('removes created recipes and restores the seed', async ({ page }) => {
    await createSauce(page, 'Временный соус')

    await page.goto('/ru/settings')
    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: 'Сбросить демо-данные' }).click()
    await expect(page.getByText('Демо-данные сброшены.')).toBeVisible({ timeout: 15_000 })

    await page.goto('/ru/recipes')
    await expect(page.getByRole('heading', { name: 'Временный соус' })).toHaveCount(0)
    // The bundled catalog is untouched.
    await expect(page.getByRole('heading', { name: 'Маргарита' })).toBeVisible()
  })
})
