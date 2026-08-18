import { expect, test } from '@playwright/test'

/**
 * Experiments.
 *
 * Two versions of the same dough, one parameter deliberately changed, and a
 * table that has to name it. The numbers are ordinary arithmetic, so what is
 * being tested is that the right ones are compared and that declaring a
 * winner does not destroy the version that lost.
 */

async function doughWithTwoVersions(page: import('@playwright/test').Page, name: string) {
  await page.goto('/ru/recipes/new?type=dough')
  await page.getByLabel('Название').fill(name)
  await page.getByLabel('Статус').selectOption('verified')

  await page.getByRole('tab', { name: 'Ингредиенты' }).click()
  for (const [label, value] of [
    ['Мука типа 00', '1000'],
    ['Вода', '600'],
  ] as const) {
    await page.getByRole('button', { name: 'Добавить ингредиент' }).click()
    await page.getByLabel('Ингредиенты', { exact: true }).last().selectOption({ label })
    await page.getByLabel('Тип количества').last().selectOption('exact')
    await page.getByLabel('Количество').last().fill(value)
  }

  await page.getByRole('button', { name: 'Создать рецепт' }).click()
  await expect(page).toHaveURL(/\/ru\/recipes\/[a-z0-9-]+$/, { timeout: 20_000 })
  const url = page.url()

  // A second version: more water, nothing else.
  await page.goto(`${url}/edit`)
  await page.getByRole('tab', { name: 'Ингредиенты' }).click()
  await page.getByLabel('Количество').last().fill('700')
  await page.getByRole('button', { name: 'Сохранить' }).click()
  await expect(page).toHaveURL(/\/ru\/recipes\/[a-z0-9-]+$/, { timeout: 20_000 })

  return url.split('/').pop()!
}

test.describe('comparing two versions as an experiment', () => {
  test('names the parameter that moved and leaves the rest alone', async ({ page }) => {
    const slug = await doughWithTwoVersions(page, 'Тесто для эксперимента')

    await page.goto(`/ru/experiments?recipe=${slug}`)
    await expect(page.getByText('Что изменилось')).toBeVisible()

    const table = page.locator('table').first()
    await expect(table).toContainText('Гидратация')
    await expect(table).toContainText('70.00%')
    await expect(table).toContainText('60.00%')

    // Salt did not change, so it is not in the headline table.
    await expect(table).not.toContainText('Соль')
  })

  test('records a hypothesis, a conclusion and a winner', async ({ page }) => {
    const slug = await doughWithTwoVersions(page, 'Тесто с выводом')

    await page.goto(`/ru/experiments?recipe=${slug}`)
    await page.getByLabel('Название эксперимента').fill('Больше воды')
    await page.getByLabel('Гипотеза', { exact: true }).fill('Корочка станет тоньше.')
    await page.getByLabel('Вывод', { exact: true }).fill('Стала, но тесто труднее формовать.')
    await page.getByLabel('Победившая версия').selectOption({ index: 1 })

    await page.getByRole('button', { name: 'Сохранить эксперимент' }).click()
    await expect(page.getByText('Эксперимент сохранён.')).toBeVisible({ timeout: 20_000 })

    await page.reload()
    await expect(page.getByText('Стала, но тесто труднее формовать.').first()).toBeVisible()
  })

  test('promoting the winner keeps the version it replaced', async ({ page }) => {
    const slug = await doughWithTwoVersions(page, 'Тесто для отката')

    await page.goto(`/ru/experiments?recipe=${slug}`)
    // Version 1 is the 600 g state kept when the recipe changed.
    await page.getByLabel('Победившая версия').selectOption({ index: 2 })

    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: 'Сделать победившую версию основной' }).click()
    await expect(page).toHaveURL(new RegExp(`/ru/recipes/${slug}$`), { timeout: 20_000 })

    // Back to 600 g of water, and the 700 g state survives as a version.
    await expect(page.getByText('600 г').first()).toBeVisible()
    await page.goto(`/ru/recipes/${slug}/versions`)
    await expect(page.getByRole('option', { name: /Версия 2/ })).toBeAttached()
  })

  test('says plainly when there is nothing to compare', async ({ page }) => {
    await page.goto('/ru/recipes/new?type=sauce')
    await page.getByLabel('Название').fill('Соус без версий')
    await page.getByRole('button', { name: 'Создать рецепт' }).click()
    await expect(page).toHaveURL(/\/ru\/recipes\/[a-z0-9-]+$/, { timeout: 20_000 })
    const slug = page.url().split('/').pop()!

    await page.goto(`/ru/experiments?recipe=${slug}`)
    await expect(page.getByText('Нужны хотя бы две версии')).toBeVisible()
  })
})
