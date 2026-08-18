import { expect, test } from '@playwright/test'

/**
 * Machine translation in the editor.
 *
 * The mock provider echoes its input with a language tag, which is exactly
 * what these tests need: a faithful translation preserves every figure, so
 * anything the guard rejects here would be a bug in the guard rather than in
 * the model.
 */

/** The editor's language tabs are tabs labelled by locale code, not by name. */
async function draftWithText(page: import('@playwright/test').Page) {
  await page.goto('/ru/recipes/new?type=dough')
  await page.getByLabel('Название').fill('Тесто на 250 °C')
  await page.getByLabel('Краткое описание').fill('Выпекать 90 секунд при 250 °C.')

  await page.getByRole('tab', { name: 'Шаги' }).click()
  await page.getByRole('button', { name: 'Добавить шаг' }).click()
  await page.getByLabel('Инструкция').last().fill('Смешать 500 г муки и 325 г воды.')
}

test.describe('translating a recipe', () => {
  test('proposes translations and applies only what was chosen', async ({ page }) => {
    await draftWithText(page)

    await page.getByRole('tab', { name: 'Перевод' }).click()
    await page.getByLabel('Перевести на').selectOption('en')
    await page.getByRole('button', { name: /Перевести/ }).click()

    // Nothing is written until the diff has been looked at.
    await expect(page.getByText('Проверьте перед применением')).toBeVisible({ timeout: 20_000 })

    await page.getByRole('button', { name: /Применить/ }).click()

    await page.getByRole('tab', { name: 'Основное' }).click()
    await page.getByRole('tab', { name: 'en', exact: true }).click()
    await expect(page.getByLabel('Название')).toHaveValue('[en] Тесто на 250 °C')
  })

  test('leaves a hand-written translation alone unless overwriting is ticked', async ({ page }) => {
    await draftWithText(page)

    // A translation typed by a person. draftWithText leaves the editor on the
    // Steps section, so the General fields have to be brought back first.
    await page.getByRole('tab', { name: 'Основное' }).click()
    await page.getByRole('tab', { name: 'en', exact: true }).click()
    await page.getByLabel('Название').fill('My own dough')

    await page.getByRole('tab', { name: 'Перевод' }).click()
    await page.getByLabel('Перевести на').selectOption('en')
    await page.getByRole('button', { name: /Перевести/ }).click()
    await expect(page.getByText('Проверьте перед применением')).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: /Применить/ }).click()

    await page.getByRole('tab', { name: 'Основное' }).click()
    await page.getByRole('tab', { name: 'en', exact: true }).click()
    await expect(page.getByLabel('Название')).toHaveValue('My own dough')
  })

  test('offers to overwrite when the owner asks for it', async ({ page }) => {
    await draftWithText(page)
    await page.getByRole('tab', { name: 'Основное' }).click()
    await page.getByRole('tab', { name: 'en', exact: true }).click()
    await page.getByLabel('Название').fill('My own dough')

    await page.getByRole('tab', { name: 'Перевод' }).click()
    await page.getByLabel('Перевести на').selectOption('en')
    await page.getByLabel('Перезаписать существующие переводы').check()
    await page.getByRole('button', { name: /Перевести/ }).click()
    await expect(page.getByText('Проверьте перед применением')).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: /Применить/ }).click()

    await page.getByRole('tab', { name: 'Основное' }).click()
    await page.getByRole('tab', { name: 'en', exact: true }).click()
    await expect(page.getByLabel('Название')).toHaveValue('[en] Тесто на 250 °C')
  })

  test('says plainly that ingredient names are out of scope', async ({ page }) => {
    await draftWithText(page)
    await page.getByRole('tab', { name: 'Перевод' }).click()
    await expect(page.getByText(/Названия ингредиентов не переводятся/)).toBeVisible()
  })

  test('a translated recipe keeps every figure it started with', async ({ page }) => {
    await draftWithText(page)

    await page.getByRole('tab', { name: 'Перевод' }).click()
    await page.getByLabel('Перевести на').selectOption('en')
    await page.getByRole('button', { name: /Перевести/ }).click()
    await expect(page.getByText('Проверьте перед применением')).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: /Применить/ }).click()

    await page.getByRole('button', { name: 'Создать рецепт' }).click()
    await expect(page).toHaveURL(/\/ru\/recipes\/[a-z0-9-]+$/, { timeout: 20_000 })

    // The English page carries the same numbers as the Russian original.
    await page.goto(page.url().replace('/ru/', '/en/'))
    await expect(page.getByText(/500 г муки и 325 г воды/)).toBeVisible()
    await expect(page.getByText(/250 °C/).first()).toBeVisible()
  })
})
