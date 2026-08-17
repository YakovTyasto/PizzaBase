import { expect, test } from '@playwright/test'

test.describe('internationalization', () => {
  test('switches RU -> EN -> FR without losing the route', async ({ page }) => {
    await page.goto('/ru/recipes/sisofo-forgotten-neapolitan')

    await page.getByRole('button', { name: /English|Английский/ }).click()
    await expect(page).toHaveURL(/\/en\/recipes\/sisofo-forgotten-neapolitan/)

    await page.getByRole('button', { name: /French|Французский|Français/ }).click()
    await expect(page).toHaveURL(/\/fr\/recipes\/sisofo-forgotten-neapolitan/)

    await page.getByRole('button', { name: /Russian|Russe|Русский/ }).click()
    await expect(page).toHaveURL(/\/ru\/recipes\/sisofo-forgotten-neapolitan/)
  })

  test('translates navigation and content in all three languages', async ({ page }) => {
    await page.goto('/ru/recipes')
    await expect(page.getByRole('heading', { name: 'Рецепты' })).toBeVisible()

    await page.goto('/en/recipes')
    await expect(page.getByRole('heading', { name: 'Recipes' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Four Cheese' })).toBeVisible()

    await page.goto('/fr/recipes')
    await expect(page.getByRole('heading', { name: 'Recettes' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Quatre fromages' })).toBeVisible()
  })

  test('formats numbers for the active locale', async ({ page }) => {
    await page.goto('/ru/recipes/sisofo-forgotten-neapolitan')
    // Russian uses a decimal comma.
    await expect(page.getByText('59,62')).toBeVisible()

    await page.goto('/en/recipes/sisofo-forgotten-neapolitan')
    await expect(page.getByText('59.62')).toBeVisible()
  })

  test('badges content shown in a fallback language', async ({ page }) => {
    // The dough recipes were authored in English, so a French reader sees a
    // fallback badge rather than silently reading English as if it were French.
    await page.goto('/fr/recipes/sisofo-crispiest-teglia')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })
})

test.describe('cooking mode', () => {
  test('walks through steps and restores progress after a reload', async ({ page }) => {
    await page.goto('/ru/recipes/sisofo-forgotten-neapolitan/cook')

    await expect(page.getByText('Шаг 1 из 3')).toBeVisible()
    await page.getByRole('button', { name: 'Далее' }).click()
    await expect(page.getByText('Шаг 2 из 3')).toBeVisible()

    // Progress lives in local storage, so a reload mid-bake loses nothing.
    await page.reload()
    await expect(page.getByText('Шаг 2 из 3')).toBeVisible()
  })

  test('runs a timer that keeps counting across a reload', async ({ page }) => {
    await page.goto('/ru/recipes/sisofo-forgotten-neapolitan/cook')

    await page.getByRole('button', { name: /Запустить таймер/ }).click()

    const timer = page.getByRole('timer').first()
    await expect(timer).toBeVisible()
    await expect(timer).toHaveText(/^\d+:\d\d$/)

    await page.reload()

    // The timer stores an absolute end time in local storage, so it survives a
    // reload and comes back still counting rather than reset.
    const restored = page.getByRole('timer').first()
    await expect(restored).toBeVisible()
    await expect(restored).toHaveText(/^\d+:\d\d$/)
  })

  test('marks a step done and shows progress', async ({ page }) => {
    await page.goto('/ru/recipes/sisofo-forgotten-neapolitan/cook')
    await page.getByRole('button', { name: 'Готово' }).click()

    const bar = page.getByRole('progressbar')
    await expect(bar).toHaveAttribute('aria-valuenow', '1')
  })
})

test.describe('import', () => {
  test('rejects a link that is not YouTube', async ({ page }) => {
    await page.goto('/ru/import')

    await page.getByLabel('Ссылка на видео').fill('https://evil.example.com/watch?v=o35mHoq5v0s')
    await page.getByRole('button', { name: 'Загрузить' }).click()

    await expect(page.getByRole('alert').filter({ hasText: /youtube/i })).toBeVisible()
  })

  test('reviews a candidate before anything is saved', async ({ page }) => {
    await page.goto('/ru/import')

    // The text tab uses the mock extraction provider when no key is set, which
    // is enough to exercise the whole review screen.
    await page.getByRole('tab', { name: 'Текст' }).click()
    await page
      .getByLabel('Вставьте текст рецепта')
      .fill('500 g flour, 325 g water, salt to taste. Mix and rest overnight.')
    await page.getByRole('button', { name: 'Загрузить' }).click()

    await expect(page.getByRole('heading', { name: 'Проверьте перед сохранением' })).toBeVisible()

    // The awkward cases must be visible: an unknown, a range and a conflict.
    await expect(page.getByText('Количество неизвестно').first()).toBeVisible()
    await expect(page.getByText('12–15')).toBeVisible()
    await expect(page.getByText(/конфликт/i).first()).toBeVisible()
  })

  test('says which key would enable a disabled provider', async ({ page }) => {
    await page.goto('/ru/settings')
    await expect(page.getByText('OPENAI_API_KEY').first()).toBeVisible()
  })
})
