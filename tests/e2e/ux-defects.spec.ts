import { expect, test } from '@playwright/test'

/**
 * The smaller verified defects, each pinned by the thing that was wrong.
 */

test.describe('number fields are keyboard entry, not spinners', () => {
  const PATHS = [
    '/ru/recipes/sisofo-forgotten-neapolitan',
    '/ru/recipes/margherita-user',
    '/ru/recipes/margherita-user/edit',
    '/ru/recipes/margherita-user/cook',
    '/ru/plan',
    '/ru/review',
    '/ru/settings',
    '/ru/pantry',
  ]

  for (const path of PATHS) {
    test(`has no spinbutton on ${path}`, async ({ page }) => {
      await page.goto(path)
      await page.waitForLoadState('networkidle')

      // Hiding the arrows in CSS would leave the control announcing itself as
      // a spinbutton with no way to step it, so the role is what is asserted.
      await expect(page.getByRole('spinbutton')).toHaveCount(0)
      expect(await page.locator('input[type="number"]').count()).toBe(0)
    })
  }

  test('still accepts typed numbers, including decimals', async ({ page }) => {
    await page.goto('/ru/recipes/sisofo-forgotten-neapolitan')

    const ballWeight = page.getByLabel('Вес шара теста')
    await expect(ballWeight).toHaveAttribute('inputmode', 'decimal')
    await ballWeight.fill('287.5')
    await expect(ballWeight).toHaveValue('287.5')

    const count = page.getByLabel('Пиццы')
    await expect(count).toHaveAttribute('inputmode', 'numeric')
    await count.fill('4')
    await expect(count).toHaveValue('4')
  })

  test('leaves the serve-time picker as a real date field', async ({ page }) => {
    await page.goto('/ru/plan')
    // datetime-local is not a spinbutton and must keep its native picker.
    await expect(page.locator('input[type="datetime-local"]').first()).toBeVisible()
  })
})

test.describe('the fermentation planner is offered only where it applies', () => {
  test('a raw sauce does not get a planner', async ({ page }) => {
    await page.goto('/ru/recipes/tomato-sauce-user')
    // Every step is hands-on: crush, tear, salt, stir. Nothing to schedule.
    await expect(page.getByRole('link', { name: 'Планировщик' })).toHaveCount(0)
  })

  test('and says so plainly if the URL is opened directly', async ({ page }) => {
    await page.goto('/ru/recipes/tomato-sauce-user/planner')
    await expect(page.getByText('В этом рецепте нечего планировать')).toBeVisible()
  })

  test('a fermented dough does get one', async ({ page }) => {
    await page.goto('/ru/recipes/sisofo-forgotten-neapolitan')
    await expect(page.getByRole('link', { name: 'Планировщик' })).toBeVisible()

    await page.goto('/ru/recipes/sisofo-forgotten-neapolitan/planner')
    await expect(page.getByLabel('Когда хотите есть?')).toBeVisible()
  })
})

test.describe('a timer starts at what it was set to', () => {
  test('a 20-minute timer never opens above 20:00', async ({ page }) => {
    await page.goto('/ru/recipes/sisofo-forgotten-neapolitan/cook')

    await page.getByLabel('Добавить таймер').fill('20')
    await page.getByRole('button', { name: 'Запустить таймер', exact: true }).click()

    const timer = page.getByRole('timer').first()
    await expect(timer).toBeVisible()

    const shown = (await timer.innerText()).trim()
    const [minutes, seconds] = shown.split(':').map(Number)
    expect(minutes! * 60 + seconds!).toBeLessThanOrEqual(20 * 60)
    expect(minutes! * 60 + seconds!).toBeGreaterThan(19 * 60 + 50)
  })

  test('survives a reload', async ({ page }) => {
    await page.goto('/ru/recipes/sisofo-forgotten-neapolitan/cook')

    await page.getByLabel('Добавить таймер').fill('20')
    await page.getByRole('button', { name: 'Запустить таймер', exact: true }).click()
    await expect(page.getByRole('timer').first()).toBeVisible()

    await page.reload()

    const restored = page.getByRole('timer').first()
    await expect(restored).toBeVisible()
    const shown = (await restored.innerText()).trim()
    const [minutes, seconds] = shown.split(':').map(Number)
    // Still counting down from where it was, and still capped at its duration.
    expect(minutes! * 60 + seconds!).toBeLessThanOrEqual(20 * 60)
    expect(minutes! * 60 + seconds!).toBeGreaterThan(18 * 60)
  })
})

test.describe('the scanner does not claim to be working before it is', () => {
  test('reads as idle until a photo is submitted', async ({ page }) => {
    await page.goto('/ru/scan')

    // "Читаем этикетку…" is a progress report, and nothing has started.
    await expect(page.getByText('Читаем этикетку…')).toHaveCount(0)
    await expect(page.getByText('Ищем штрихкод…')).toHaveCount(0)
    await expect(page.getByText(/Сфотографируйте/)).toBeVisible()
  })
})

test.describe('Russian package units are distinguishable', () => {
  test('a can and a jar do not read as the same word', async ({ page }) => {
    await page.goto('/ru/pantry')

    const unit = page.getByLabel('Единицы')
    const options = await unit.locator('option').allInnerTexts()
    const packageWords = options.filter((label) => label.includes('банка'))

    // Both exist, and they are not the same string.
    expect(packageWords).toContain('жестяная банка')
    expect(packageWords).toContain('стеклянная банка')
    expect(new Set(packageWords).size).toBe(packageWords.length)
  })
})

test.describe('no server internals reach the page', () => {
  const PATHS = ['/ru', '/ru/recipes', '/ru/plan', '/ru/pantry', '/ru/settings', '/ru/experiments']

  for (const path of PATHS) {
    test(`shows no path or stack on ${path}`, async ({ page }) => {
      await page.goto(path)
      await page.waitForLoadState('networkidle')

      const body = await page.locator('body').innerText()
      expect(body).not.toMatch(/ENOENT/)
      expect(body).not.toMatch(/\/var\/task/)
      expect(body).not.toMatch(/impasto-demo/)
      expect(body).not.toMatch(/\bat \w+ \(.*:\d+:\d+\)/)
    })
  }
})

test.describe('a recipe page has a loading state of its own', () => {
  test('never renders an empty main region', async ({ page }) => {
    await page.goto('/ru/recipes/margherita-user')

    const main = page.locator('main#main')
    await expect(main).toBeVisible()
    // Either the recipe-shaped skeleton or the recipe itself is present. What
    // must never happen is an empty region while the page streams in.
    expect(await main.locator('> *').count()).toBeGreaterThan(0)

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    expect((await main.innerText()).trim().length).toBeGreaterThan(0)
  })
})
