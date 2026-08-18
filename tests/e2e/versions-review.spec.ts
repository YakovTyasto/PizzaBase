import { expect, test } from '@playwright/test'

/**
 * Versions and the needs-review screen.
 *
 * Changing a verified recipe must never destroy what it was, and an open
 * question must be answerable once, in one place, with every dependent
 * calculation following from that single answer.
 */

async function createVerifiedSauce(page: import('@playwright/test').Page, name: string) {
  await page.goto('/ru/recipes/new?type=sauce')

  await page.getByLabel('Название').fill(name)
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
  return page.url()
}

test.describe('versions of a verified recipe', () => {
  test('a fresh recipe has no history to show', async ({ page }) => {
    const url = await createVerifiedSauce(page, 'Соус без истории')

    await page.goto(`${url}/versions`)
    await expect(page.getByText('Прежних версий пока нет.')).toBeVisible()
  })

  test('changing a verified recipe keeps a snapshot of what it was', async ({ page }) => {
    const url = await createVerifiedSauce(page, 'Соус с историей')

    await page.goto(`${url}/edit`)
    await page.getByRole('tab', { name: 'Ингредиенты' }).click()
    await page.getByLabel('Количество').last().fill('500')
    await page.getByRole('button', { name: 'Сохранить' }).click()
    await expect(page).toHaveURL(/\/ru\/recipes\/[a-z0-9-]+$/, { timeout: 20_000 })

    await page.goto(`${url}/versions`)

    // The previous state survives as version 1.
    await expect(page.getByRole('option', { name: /Версия 1/ })).toBeAttached()

    // And the comparison names the quantity that moved, in both directions.
    await expect(page.getByText('tomatoes-whole-peeled-canned')).toBeVisible()
    await expect(page.getByText('400 g')).toBeVisible()
    await expect(page.getByText('500 g')).toBeVisible()
    await expect(page.getByText('Изменилось').first()).toBeVisible()
  })

  test('a second edit adds a second version rather than replacing the first', async ({ page }) => {
    const url = await createVerifiedSauce(page, 'Соус с двумя версиями')

    for (const value of ['500', '600']) {
      await page.goto(`${url}/edit`)
      await page.getByRole('tab', { name: 'Ингредиенты' }).click()
      await page.getByLabel('Количество').last().fill(value)
      await page.getByRole('button', { name: 'Сохранить' }).click()
      await expect(page).toHaveURL(/\/ru\/recipes\/[a-z0-9-]+$/, { timeout: 20_000 })
    }

    await page.goto(`${url}/versions`)
    await expect(page.getByRole('option', { name: /Версия 1/ })).toBeAttached()
    await expect(page.getByRole('option', { name: /Версия 2/ })).toBeAttached()
  })

  test('making an older version primary restores it and keeps the newer one', async ({ page }) => {
    const url = await createVerifiedSauce(page, 'Соус для отката')

    await page.goto(`${url}/edit`)
    await page.getByRole('tab', { name: 'Ингредиенты' }).click()
    await page.getByLabel('Количество').last().fill('500')
    await page.getByRole('button', { name: 'Сохранить' }).click()
    await expect(page).toHaveURL(/\/ru\/recipes\/[a-z0-9-]+$/, { timeout: 20_000 })

    await page.goto(`${url}/versions`)
    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: 'Сделать основной версией' }).click()
    await expect(page).toHaveURL(/\/ru\/recipes\/[a-z0-9-]+$/, { timeout: 20_000 })

    // Back to the original 400 g, and the 500 g state is itself now a version.
    await expect(page.getByText('400 г').first()).toBeVisible()
    await page.goto(`${url}/versions`)
    await expect(page.getByRole('option', { name: /Версия 2/ })).toBeAttached()
  })
})

test.describe('the needs-review screen', () => {
  test('collects the open questions the seeded collection actually has', async ({ page }) => {
    await page.goto('/ru/review')

    await expect(page.getByRole('heading', { name: 'Нужна проверка', level: 1 })).toBeVisible()
    // The unresolved things the brief names, gathered in one place.
    await expect(page.getByText(/открыт/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Сохранить ответ' }).first()).toBeVisible()
  })

  test('never proposes a package size as the confirmed answer', async ({ page }) => {
    await page.goto('/ru/review')

    const packagePicker = page.getByLabel('Размер банки или упаковки').first()
    if ((await packagePicker.count()) > 0) {
      // The selected option is the neutral one; a size has to be chosen, not
      // inherited from a guess.
      await expect(packagePicker).toHaveValue('')
      await expect(page.getByText(/за вас ничего не предполагается/).first()).toBeVisible()
    }
  })

  test('answering an unknown amount updates the recipe it came from', async ({ page }) => {
    // A recipe of our own with a deliberately unknown amount, so the test does
    // not depend on which seeded question happens to sort first.
    await page.goto('/ru/recipes/new?type=sauce')
    await page.getByLabel('Название').fill('Соус с вопросом')
    await page.getByLabel('Выход').fill('400')
    await page.getByLabel('Единицы').selectOption('g')
    await page.getByRole('tab', { name: 'Ингредиенты' }).click()
    await page.getByRole('button', { name: 'Добавить ингредиент' }).click()
    await page
      .getByLabel('Ингредиенты', { exact: true })
      .last()
      .selectOption({ label: 'Оливковое масло extra virgin' })
    await page.getByLabel('Тип количества').last().selectOption('unknown')
    await page.getByRole('button', { name: 'Создать рецепт' }).click()
    await expect(page).toHaveURL(/\/ru\/recipes\/[a-z0-9-]+$/, { timeout: 20_000 })
    const url = page.url()

    await expect(page.getByText('Количество неизвестно').first()).toBeVisible()

    await page.goto('/ru/review')
    // Scoped to our own recipe: the seeded collection asks the same question
    // about several others, and answering the wrong one would prove nothing.
    const card = page
      .locator('section')
      .filter({ hasText: 'Соус с вопросом' })
      .locator('li')
      .first()
    await expect(card).toContainText('Сколько нужно «Оливковое масло extra virgin»?')
    await card.getByLabel('Тип количества').selectOption('exact')
    await card.getByLabel('Количество').fill('30')
    await card.getByRole('button', { name: 'Сохранить ответ' }).click()

    // Either the card reports it, or the section has gone entirely because
    // this was the recipe's last open question. Both mean the answer landed;
    // which one you see depends on whether the revalidation beats the badge.
    await expect
      .poll(
        async () => {
          const answered = await card.getByText('Отвечено').count()
          const stillListed = await page
            .locator('section')
            .filter({ hasText: 'Соус с вопросом' })
            .count()
          return answered > 0 || stillListed === 0
        },
        { timeout: 20_000 },
      )
      .toBe(true)

    // One answer, and the recipe itself now carries the number.
    await page.goto(url)
    await expect(page.getByText('30 г').first()).toBeVisible()
    await expect(page.getByText('Количество неизвестно')).toHaveCount(0)
  })
})
